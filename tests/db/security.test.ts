import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createLicensee, createUser, freshDb, participation, refresh, sellAndVerify, xpTotal, type Db } from "./helpers";

let db: Db;
let admin: string;
let ana: string;
let beto: string;

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
  ana = await createLicensee(db, "ana@test.com");
  beto = await createLicensee(db, "beto@test.com");
  await refresh(db, ana);
  await refresh(db, beto);
  await sellAndVerify(db, ana, admin, { customer: "Cliente privado" });
  const p = await participation(db, ana, "D02");
  await db.as(ana, `select public.submit_mission_evidence($1, 'https://instagram.com/reel/ana')`, [p.id]);
});
after(() => db.close());

describe("Los usuarios no pueden modificar sus XP", () => {
  it("no pueden insertar, editar ni borrar en el historial de XP", async () => {
    await assert.rejects(
      db.as(ana, `insert into public.xp_ledger (user_id, amount, transaction_type, description, idempotency_key, created_by) values ($1, 5000, 'admin_adjustment', 'hack', 'hack', $1)`, [ana]),
      /permission denied/,
    );
    await assert.rejects(db.as(ana, `update public.xp_ledger set amount = 99999`), /permission denied/);
    await assert.rejects(db.as(ana, `delete from public.xp_ledger`), /permission denied/);
  });

  it("no pueden invocar las funciones internas de concesión", async () => {
    const p = await participation(db, ana, "D03");
    await assert.rejects(db.as(ana, `select public.recompute_participation($1)`, [p.id]), /permission denied/);
    await assert.rejects(db.as(ana, `select public.ensure_participations($1)`, [ana]), /permission denied/);
    await assert.rejects(db.as(ana, `select public.run_mission_maintenance()`), /permission denied/);
  });

  it("no pueden autoasignarse XP ni cambiar su rol", async () => {
    await assert.rejects(db.as(ana, `select public.admin_adjust_xp($1, 1000, 'Me lo merezco', 'k1')`, [ana]), /administrador/);
    const changed = await db.as(ana, `update public.profiles set role = 'admin' where id = $1 returning id`, [ana]);
    assert.equal(changed.length, 0);
    await db.as(ana, `select public.update_my_profile('Ana', 'Ana GN')`);
    const [p] = await db.sql<{ role: string; public_alias: string }>(`select role, public_alias from public.profiles where id = $1`, [ana]);
    assert.deepEqual(p, { role: "licensee", public_alias: "Ana GN" });
  });

  it("el administrador tampoco puede ajustarse sus propios XP", async () => {
    await assert.rejects(db.as(admin, `select public.admin_adjust_xp($1, 10, 'Ajuste propio', 'k2')`, [admin]), /propios/);
  });

  it("el historial es inmutable incluso para el administrador y el superusuario", async () => {
    await assert.rejects(db.as(admin, `update public.xp_ledger set amount = 1`), /permission denied/);
    await assert.rejects(db.sql(`update public.xp_ledger set amount = 1`), /solo inserción/);
    await assert.rejects(db.sql(`delete from public.xp_ledger`), /solo inserción/);
    await assert.rejects(db.sql(`delete from public.audit_log`), /solo inserción/);
  });

  it("los ajustes administrativos son idempotentes y quedan auditados", async () => {
    const before = await xpTotal(db, beto);
    const [a] = await db.as<{ id: string }>(admin, `select public.admin_adjust_xp($1, 50, 'Corrección de evidencia perdida', 'adj-001') as id`, [beto]);
    const [b] = await db.as<{ id: string }>(admin, `select public.admin_adjust_xp($1, 50, 'Corrección de evidencia perdida', 'adj-001') as id`, [beto]);
    assert.equal(a.id, b.id);
    assert.equal(await xpTotal(db, beto), before + 50);
    const audit = await db.sql(`select id from public.audit_log where action = 'xp.adjusted' and entity_id = $1`, [String(a.id)]);
    assert.equal(audit.length, 1);
    await assert.rejects(db.as(admin, `select public.admin_adjust_xp($1, 50, '', 'adj-002')`, [beto]), /motivo/);
  });
});

describe("Aislamiento entre licenciados", () => {
  const tables = ["mission_participations", "mission_evidences", "xp_ledger", "sales", "licenses"];

  for (const table of tables) {
    it(`${table}: cada licenciado ve solo lo suyo`, async () => {
      const col = table === "sales" ? "licensee_id" : "user_id";
      const rows = await db.as<Record<string, string>>(beto, `select ${col} as owner from public.${table}`);
      assert.ok(rows.every((r) => r.owner === beto), `beto vio filas ajenas en ${table}`);
      const anas = await db.as(ana, `select 1 from public.${table}`);
      assert.ok(anas.length > 0, `ana debería ver sus filas en ${table}`);
    });
  }

  it("no se ven perfiles, auditoría ni alertas ajenas", async () => {
    const profiles = await db.as<{ id: string }>(beto, `select id from public.profiles`);
    assert.deepEqual(profiles.map((p) => p.id), [beto]);
    assert.equal((await db.as(beto, `select id from public.audit_log`)).length, 0);
    assert.equal((await db.as(beto, `select id from public.fraud_flags`)).length, 0);
  });

  it("el saldo de XP respeta RLS", async () => {
    const rows = await db.as<{ user_id: string }>(beto, `select user_id from public.user_xp_balances`);
    assert.ok(rows.every((r) => r.user_id === beto));
  });

  it("el visitante anónimo solo ve planes no inactivos", async () => {
    const plans = await db.anon<{ code: string }>(`select code from public.license_plans order by code`);
    assert.deepEqual(plans.map((p) => p.code), ["PLAN_1", "PLAN_2", "PLAN_3", "PLAN_4"]);
    await assert.rejects(db.anon(`select id from public.missions`), /permission denied/);
    await assert.rejects(db.anon(`select id from public.xp_ledger`), /permission denied/);
    await assert.rejects(db.anon(`select public.refresh_my_missions()`), /permission denied/);
  });

  it("el administrador ve todo", async () => {
    const rows = await db.as<{ user_id: string }>(admin, `select distinct user_id from public.mission_participations`);
    assert.ok(rows.length >= 2);
  });
});
