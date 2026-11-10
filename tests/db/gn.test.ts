// GN del club, Fase 1: espera de 7 días, ganancia por ventas y misiones, reversiones y saldo.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { HOODIE, SHIRT, account, ageAndSettle, assertConsistent, createLicensee, createUser, freshDb, issueUnits, participation, posCheckout, refresh, type Db } from "./helpers";

let db: Db;
let admin: string;

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
});
after(() => db.close());

const setConfig = (key: string, value: unknown) => db.as(admin, `select public.gn_set_config($1, $2::jsonb)`, [key, JSON.stringify(value)]);

async function sellUnits(userId: string, n: number, sku = SHIRT, price = 35, customer: string | null = null) {
  const codes = await issueUnits(db, admin, userId, { quantity: n, price, sku });
  return posCheckout(db, userId, codes, customer);
}

describe("GN por venta", () => {
  it("cada prenda vendida deja 12 GN pendientes y la primera venta del día suma 12 más", async () => {
    const ana = await createLicensee(db, `ana-${randomUUID()}@test.com`);
    await refresh(db, ana);
    await sellUnits(ana, 2);
    const a = await account(db, ana);
    assert.equal(a.pending, 2 * 12 + 12);
    assert.equal(a.available, 0);
    // Los XP de D01 se conceden al instante, como antes.
    assert.equal((await participation(db, ana, "D01")).status, "completed");
    await assertConsistent(db, ana);
  });

  it("al cumplirse la espera los GN pasan solos a disponibles, con vencimiento a 12 meses", async () => {
    const u = await createLicensee(db, `libera-${randomUUID()}@test.com`);
    await refresh(db, u);
    const sale = await sellUnits(u, 1);
    await db.sql(`select public.gn_settle($1)`, [u]);
    assert.equal((await account(db, u)).available, 0, "antes de 7 días no se libera");
    await ageAndSettle(db, u);
    const a = await account(db, u);
    assert.equal(a.available, 24);
    assert.equal(a.pending, 0);
    const [h] = await db.sql<{ status: string }>(`select status from public.gn_sale_holds where sale_id = $1`, [sale]);
    assert.equal(h.status, "liberada");
    const [lot] = await db.sql<{ months: number }>(
      `select round(extract(epoch from (expires_at - available_at)) / 86400 / 30)::int as months from public.gn_lots where user_id = $1 limit 1`,
      [u],
    );
    assert.ok(lot.months >= 12 && lot.months <= 13);
    const notes = await db.sql(`select 1 from public.notifications where user_id = $1 and kind = 'gn_liberados'`, [u]);
    assert.equal(notes.length, 1);
    await assertConsistent(db, u);
  });

  it("partir una compra en varios tickets no da GN de más (modo por prenda)", async () => {
    const a = await createLicensee(db, `junto-${randomUUID()}@test.com`);
    const b = await createLicensee(db, `partido-${randomUUID()}@test.com`);
    await sellUnits(a, 3);
    for (let i = 0; i < 3; i++) await sellUnits(b, 1);
    // Sin la bonificación de misión (no abrieron misiones), la venta da lo mismo.
    assert.equal((await account(db, a)).pending, (await account(db, b)).pending);
  });

  it("aplica el tope diario de prendas con GN y el valor mínimo por prenda", async () => {
    const u = await createLicensee(db, `tope-${randomUUID()}@test.com`);
    await setConfig("gn_max_diario", 3);
    await setConfig("pvp_por_categoria", { gorras: 10 });
    try {
      await sellUnits(u, 2);
      await sellUnits(u, 2);
      const [h] = await db.sql<{ units: number }>(`select sum(units_with_gn)::int as units from public.gn_sale_holds where licensee_id = $1`, [u]);
      assert.equal(h.units, 3);
      assert.equal((await account(db, u)).pending, 36 + 12, "incluye la primera venta del día");
      const gorra = await sellUnits(u, 1, "DEMO-GOR-01", 10);
      const [g] = await db.sql<{ gn: number; pvp: string }>(`select gn_amount as gn, pvp_total::text as pvp from public.gn_sale_holds where sale_id = $1`, [gorra]);
      assert.equal(g.gn, 0, "una prenda de $10 no alcanza el mínimo de $15");
      assert.equal(Number(g.pvp), 10, "pero cuenta su PVP oficial para el rango");
    } finally {
      await setConfig("gn_max_diario", 20);
      await setConfig("pvp_por_categoria", {});
    }
  });

  it("los modos por venta y por dólar se calculan con la función pura", async () => {
    const calc = async (mode: string, units: number, pvp: number, used = 0) => {
      const [r] = await db.sql<{ units_with_gn: number; gn: number }>(
        `select * from public.gn_sale_amount($1, 12, 0.343, 15, 20, $2, $3, $3, $4)`,
        [mode, units, pvp, used],
      );
      return r;
    };
    assert.deepEqual(await calc("por_venta", 3, 105), { units_with_gn: 1, gn: 12 });
    assert.deepEqual(await calc("por_dolar", 3, 105), { units_with_gn: 1, gn: 36 });
    assert.deepEqual(await calc("por_prenda", 3, 105, 18), { units_with_gn: 2, gn: 24 });
    assert.deepEqual(await calc("por_venta", 1, 10), { units_with_gn: 0, gn: 0 });
  });
});

describe("Anulaciones y devoluciones", () => {
  it("anular durante la espera cancela los GN de la venta y su bono si no queda otra venta del día", async () => {
    const u = await createLicensee(db, `anula-${randomUUID()}@test.com`);
    await refresh(db, u);
    const sale = await sellUnits(u, 1);
    assert.equal((await account(db, u)).pending, 24);
    await db.as(u, `select public.cancel_sale($1, 'Error de caja')`, [sale]);
    const a = await account(db, u);
    assert.equal(a.pending, 0);
    const [c] = await db.sql<{ status: string }>(`select status from public.gn_mission_credits where user_id = $1`, [u]);
    assert.equal(c.status, "revertido");
    await assertConsistent(db, u);
  });

  it("si otra venta del día sigue cumpliendo la misión, el bono pasa a esa venta", async () => {
    const u = await createLicensee(db, `relink-${randomUUID()}@test.com`);
    await refresh(db, u);
    const first = await sellUnits(u, 1);
    const second = await sellUnits(u, 1);
    await db.as(u, `select public.cancel_sale($1, 'Error de caja')`, [first]);
    const [c] = await db.sql<{ status: string; sale_id: string }>(`select status, sale_id from public.gn_mission_credits where user_id = $1`, [u]);
    assert.equal(c.status, "pendiente");
    assert.equal(c.sale_id, second);
    assert.equal((await account(db, u)).pending, 12 + 12);
    await assertConsistent(db, u);
  });

  it("una devolución después de la espera descuenta del disponible y lo que falta queda por cubrir", async () => {
    const u = await createLicensee(db, `devuelve-${randomUUID()}@test.com`);
    const sale = await sellUnits(u, 2);
    await ageAndSettle(db, u);
    // 2 prendas × 12 + 12 de la primera venta del día.
    assert.equal((await account(db, u)).available, 36);
    await db.as(admin, `select public.gn_admin_adjust($1, -20, 'Corrección de prueba', $2)`, [u, randomUUID()]);
    assert.equal((await account(db, u)).available, 16);
    await db.as(admin, `select public.gn_return_sale($1, 'Cliente devolvió las prendas')`, [sale]);
    const a = await account(db, u);
    assert.equal(a.available, 0);
    // 24 de la venta + 12 del bono que ya no tiene venta: 36 − 16 disponibles = 20 por cubrir.
    assert.equal(a.debt, 20);
    const [h] = await db.sql<{ status: string; voided_after_release: boolean }>(
      `select status, voided_after_release from public.gn_sale_holds where sale_id = $1`,
      [sale],
    );
    assert.deepEqual(h, { status: "anulada", voided_after_release: true });
    // Los GN nuevos cubren primero el saldo por cubrir.
    await sellUnits(u, 2);
    await ageAndSettle(db, u);
    const b = await account(db, u);
    assert.equal(b.debt, 0);
    assert.equal(b.available, 4);
    await assertConsistent(db, u);
  });

  it("solo el administrador registra devoluciones y ajustes", async () => {
    const u = await createLicensee(db, `nadmin-${randomUUID()}@test.com`);
    const sale = await sellUnits(u, 1);
    await assert.rejects(db.as(u, `select public.gn_return_sale($1, 'x')`, [sale]), /administrador/);
    await assert.rejects(db.as(u, `select public.gn_admin_adjust($1, 100, 'Me regalo GN', 'k1')`, [u]), /administrador/);
  });
});

describe("Verificación y revisión", () => {
  it("un precio fuera del margen manda la venta a revisión: no se libera hasta que el admin la aprueba", async () => {
    const u = await createLicensee(db, `revision-${randomUUID()}@test.com`);
    const sale = await sellUnits(u, 1, SHIRT, 80);
    const [h] = await db.sql<{ status: string; flags: string[] }>(`select status, flags from public.gn_sale_holds where sale_id = $1`, [sale]);
    assert.equal(h.status, "en_revision");
    assert.ok(h.flags.includes("precio"));
    await db.sql(`update public.gn_sale_holds set hold_until = now() - interval '1 second' where sale_id = $1`, [sale]);
    await db.sql(`select public.gn_settle($1)`, [u]);
    assert.equal((await account(db, u)).available, 0);
    await db.as(admin, `select public.gn_review_sale($1, true, 'Precio de promoción autorizado')`, [sale]);
    // La prenda y el bono de la primera venta del día, que sigue el plazo de su venta.
    assert.equal((await account(db, u)).available, 24);
    const audit = await db.sql(`select 1 from public.audit_log where action = 'gn.sale_approved' and entity_id = $1`, [sale]);
    assert.equal(audit.length, 1);
  });

  it("el admin puede anular una venta en revisión: se cancela la venta y sus GN", async () => {
    const u = await createLicensee(db, `revanula-${randomUUID()}@test.com`);
    const sale = await sellUnits(u, 1, HOODIE, 90);
    await db.as(admin, `select public.gn_review_sale($1, false, 'Venta ficticia')`, [sale]);
    const [s] = await db.sql<{ status: string }>(`select status from public.sales where id = $1`, [sale]);
    assert.equal(s.status, "cancelled");
    assert.equal((await account(db, u)).pending, 0);
    await assertConsistent(db, u);
  });

  it("una ráfaga de tickets en pocos minutos queda en revisión", async () => {
    const u = await createLicensee(db, `rafaga-${randomUUID()}@test.com`);
    for (let i = 0; i < 4; i++) await sellUnits(u, 1);
    const rows = await db.sql<{ status: string }>(`select status from public.gn_sale_holds where licensee_id = $1 order by created_at`, [u]);
    assert.equal(rows.at(-1)?.status, "en_revision");
  });
});

describe("GN por misión", () => {
  it("una misión con evidencia acredita sus GN disponibles al aprobarse", async () => {
    const u = await createLicensee(db, `reel-${randomUUID()}@test.com`);
    await refresh(db, u);
    const p = await participation(db, u, "D02");
    const [r] = await db.as<{ res: { ok: boolean; evidence_id: string } }>(u, `select public.submit_mission_evidence($1, $2) as res`, [
      p.id,
      `https://instagram.com/reel/${randomUUID()}`,
    ]);
    assert.equal((await account(db, u)).available, 0);
    await db.as(admin, `select public.review_mission_evidence($1, true)`, [r.res.evidence_id]);
    assert.equal((await account(db, u)).available, 4);
    await assertConsistent(db, u);
  });

  it("respeta el tope diario de GN por misiones", async () => {
    const u = await createLicensee(db, `topemision-${randomUUID()}@test.com`);
    await db.sql(`update public.missions set gn_reward = 15 where code in ('D02', 'D03')`);
    try {
      await refresh(db, u);
      for (const code of ["D02", "D03"]) {
        const p = await participation(db, u, code);
        const [r] = await db.as<{ res: { evidence_id: string } }>(u, `select public.submit_mission_evidence($1, $2) as res`, [
          p.id,
          `https://instagram.com/p/${randomUUID()}`,
        ]);
        await db.as(admin, `select public.review_mission_evidence($1, true)`, [r.res.evidence_id]);
      }
      assert.equal((await account(db, u)).available, 20);
    } finally {
      await db.sql(`update public.missions set gn_reward = case code when 'D02' then 4 else 0 end where code in ('D02', 'D03')`);
    }
  });

  it("el admin edita los GN de una misión sin tocar sus XP", async () => {
    const [m] = await db.sql<{ id: string; xp_reward: number }>(`select id, xp_reward from public.missions where code = 'S01'`);
    await db.as(admin, `select public.gn_set_mission_gn($1, 7)`, [m.id]);
    const [after] = await db.sql<{ gn_reward: number; xp_reward: number }>(`select gn_reward, xp_reward from public.missions where id = $1`, [m.id]);
    assert.deepEqual(after, { gn_reward: 7, xp_reward: m.xp_reward });
    await db.as(admin, `select public.gn_set_mission_gn($1, 0)`, [m.id]);
  });
});

describe("Seguridad del libro", () => {
  it("el libro es de solo inserción y los ajustes son idempotentes", async () => {
    const u = await createLicensee(db, `idem-${randomUUID()}@test.com`);
    const key = randomUUID();
    await db.as(admin, `select public.gn_admin_adjust($1, 50, 'Premio de bienvenida', $2)`, [u, key]);
    await db.as(admin, `select public.gn_admin_adjust($1, 50, 'Premio de bienvenida', $2)`, [u, key]);
    assert.equal((await account(db, u)).available, 50);
    await assert.rejects(db.sql(`update public.gn_ledger set d_available = 999 where user_id = $1`, [u]), /solo inserción/);
    await assert.rejects(db.sql(`delete from public.gn_ledger where user_id = $1`, [u]), /solo inserción/);
  });

  it("cada licenciatario solo ve lo suyo y nadie escribe saldos desde la API", async () => {
    const u = await createLicensee(db, `rls-${randomUUID()}@test.com`);
    const other = await createLicensee(db, `rls2-${randomUUID()}@test.com`);
    await db.as(admin, `select public.gn_admin_adjust($1, 10, 'Prueba de acceso', $2)`, [u, randomUUID()]);
    assert.equal((await db.as(other, `select * from public.gn_ledger where user_id = $1`, [u])).length, 0);
    assert.equal((await db.as(other, `select * from public.gn_accounts where user_id = $1`, [u])).length, 0);
    assert.equal((await db.as(u, `select * from public.gn_ledger where user_id = $1`, [u])).length, 1);
    await assert.rejects(db.as(u, `update public.gn_accounts set available = 9999 where user_id = $1`, [u]), /permission denied/);
    await assert.rejects(
      db.as(u, `insert into public.gn_ledger (user_id, kind, d_available, description, idempotency_key) values ($1, 'ajuste_admin', 100, 'x', 'x1')`, [u]),
      /permission denied/,
    );
    await assert.rejects(db.as(u, `select public.gn_settle($1)`, [u]), /permission denied/);
    assert.equal((await db.as(u, `select * from public.gn_config`)).length, 0);
  });

  it("el licenciatario consulta su saldo con my_gn_summary y solo recibe cifras públicas", async () => {
    const u = await createLicensee(db, `resumen-${randomUUID()}@test.com`);
    await sellUnits(u, 1);
    const [r] = await db.as<{ s: { available: number; pending: number; expiring_30: number } }>(u, `select public.my_gn_summary() as s`);
    assert.equal(r.s.pending, 12 + 12);
    const [c] = await db.as<{ c: Record<string, unknown> }>(u, `select public.gn_public_config() as c`);
    assert.ok(!("gn_valor_interno_usd" in c.c));
    assert.ok(!("costo_produccion_usd" in c.c));
  });
});
