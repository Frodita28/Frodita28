import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, freshDb, type Db } from "./helpers";

let db: Db;
let admin: string;

const PROVISION = `select public.provision_account($1, $2, $3::public.app_role, $4, $5, $6, $7)`;

/** Simula auth.admin.createUser: crea el usuario de Auth con su correo interno. */
async function authUser(username: string) {
  const [u] = await db.sql<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${username}@usuarios.gallonegro.local`]);
  return u.id;
}

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
});
after(() => db.close());

describe("Cuentas asignadas por el administrador", () => {
  it("un licenciado nuevo queda con usuario, tienda y licencia activa en el primer plan", async () => {
    const id = await authUser("tiendita");
    await db.service(PROVISION, [id, " Tiendita ", "licensee", "Dueña Tiendita", "Tiendita", null, admin]);
    const [p] = await db.sql<{ username: string; role: string; store_name: string; full_name: string }>(
      `select username, role, store_name, full_name from public.profiles where id = $1`,
      [id],
    );
    assert.deepEqual(p, { username: "tiendita", role: "licensee", store_name: "Tiendita", full_name: "Dueña Tiendita" });
    const [l] = await db.sql<{ status: string; code: string; created_by: string }>(
      `select l.status, pl.code, l.created_by from public.licenses l join public.license_plans pl on pl.id = l.plan_id where l.user_id = $1`,
      [id],
    );
    assert.deepEqual(l, { status: "active", code: "PLAN_1", created_by: admin });
    const [a] = await db.sql<{ actor_id: string; details: { username: string } }>(
      `select actor_id, details from public.audit_log where action = 'account.provisioned' and entity_id = $1`,
      [id],
    );
    assert.equal(a.actor_id, admin);
    assert.equal(a.details.username, "tiendita");
  });

  it("respeta el plan elegido y crea administradores o solicitantes sin licencia", async () => {
    const [plan3] = await db.sql<{ id: string }>(`select id from public.license_plans where code = 'PLAN_3'`);
    const lic = await authUser("tienda.norte");
    await db.service(PROVISION, [lic, "tienda.norte", "licensee", null, null, plan3.id, admin]);
    const [l] = await db.sql<{ plan_id: string }>(`select plan_id from public.licenses where user_id = $1`, [lic]);
    assert.equal(l.plan_id, plan3.id);

    const adm = await authUser("jefe");
    await db.service(PROVISION, [adm, "jefe", "admin", null, null, null, admin]);
    const app = await authUser("interesado");
    await db.service(PROVISION, [app, "interesado", "applicant", null, null, null, admin]);
    const roles = await db.sql<{ username: string; role: string }>(
      `select username, role from public.profiles where username in ('jefe', 'interesado') order by username`,
    );
    assert.deepEqual(roles, [{ username: "interesado", role: "applicant" }, { username: "jefe", role: "admin" }]);
    const [{ n }] = await db.sql<{ n: number }>(`select count(*)::int as n from public.licenses where user_id in ($1, $2)`, [adm, app]);
    assert.equal(n, 0);
  });

  it("rechaza usuarios repetidos o con formato no válido", async () => {
    const dup = await authUser("otra");
    await assert.rejects(db.service(PROVISION, [dup, "tiendita", "licensee", null, null, null, admin]), /ya está en uso/);
    await assert.rejects(db.service(PROVISION, [dup, "con espacio", "licensee", null, null, null, admin]), /check constraint/);
  });

  it("solo la service role puede crear cuentas o escribir auditoría a nombre de otro", async () => {
    const id = await authUser("intruso");
    await assert.rejects(db.as(admin, PROVISION, [id, "intruso", "admin", null, null, null, admin]), /permission denied/);
    await assert.rejects(db.as(id, PROVISION, [id, "intruso", "admin", null, null, null, id]), /permission denied/);
    await assert.rejects(db.anon(PROVISION, [id, "intruso", "admin", null, null, null, null]), /permission denied/);
    await assert.rejects(
      db.as(admin, `select public.write_audit_as($1, 'x', 'profile', null, '{}'::jsonb)`, [admin]),
      /permission denied/,
    );
  });
});
