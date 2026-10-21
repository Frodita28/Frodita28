import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createLicensee, createUser, freshDb, HOODIE, productId, registerSale, sellAndVerify, SHIRT, type Db } from "./helpers";

let db: Db;
let admin: string;

type Summary = {
  total_xp: number;
  levels_configured: boolean;
  level: { name: string } | null;
  next_level: { name: string; minimum_xp: number } | null;
  units_sold: number;
  revenue: number;
  stock_balance: number;
  units_delivered: number;
  investment: number;
  monthly: { month: string; revenue: number; units: number }[];
};

async function summary(asUser: string, of: string = asUser) {
  const [r] = await db.as<{ s: Summary }>(asUser, `select public.store_summary($1) as s`, [of]);
  return r.s;
}

const deliver = async (licensee: string, sku: string, quantity: number, kind = "delivery") =>
  db.as(admin, `select public.record_stock_movement($1, $2, $3::public.stock_movement_kind, $4, null)`, [
    licensee,
    await productId(db, sku),
    kind,
    quantity,
  ]);

const invest = (licensee: string, concept: string, amount: number, on = "2026-10-01") =>
  db.as(admin, `select public.record_store_investment($1, $2::public.investment_concept, $3, $4::date, null)`, [licensee, concept, amount, on]);

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
});
after(() => db.close());

describe("Nombre de la tienda", () => {
  it("el licenciado nombra su tienda pero no puede editar el perfil directamente", async () => {
    const ana = await createLicensee(db, "ana@test.com");
    await db.as(ana, `select public.update_my_store('Urbano Ana', 'Ana Pérez', 'AnaGN')`);
    const [p] = await db.as<{ store_name: string; full_name: string; public_alias: string }>(
      ana,
      `select store_name, full_name, public_alias from public.profiles where id = $1`,
      [ana],
    );
    assert.deepEqual(p, { store_name: "Urbano Ana", full_name: "Ana Pérez", public_alias: "AnaGN" });
    const updated = await db.as(ana, `update public.profiles set store_name = 'Otra' where id = $1 returning id`, [ana]);
    assert.equal(updated.length, 0);
  });

  it("rechaza nombres de un solo carácter", async () => {
    const leo = await createLicensee(db, "leo@test.com");
    await assert.rejects(db.as(leo, `select public.update_my_store('X', null, null)`), /store_name/);
  });
});

describe("Resumen de Tu Tienda", () => {
  it("una tienda nueva muestra todo en cero, sin inventar cifras", async () => {
    const nuevo = await createLicensee(db, "nuevo@test.com");
    const s = await summary(nuevo);
    assert.equal(Number(s.total_xp), 0);
    assert.equal(Number(s.units_sold), 0);
    assert.equal(Number(s.revenue), 0);
    assert.equal(Number(s.stock_balance), 0);
    assert.equal(Number(s.investment), 0);
    assert.equal(s.level, null);
    assert.equal(s.levels_configured, false);
    assert.equal(s.monthly.length, 6);
    assert.ok(s.monthly.every((m) => Number(m.revenue) === 0 && Number(m.units) === 0));
  });

  it("solo las ventas verificadas cuentan para ventas, total generado y existencias", async () => {
    const bea = await createLicensee(db, "bea@test.com");
    await deliver(bea, SHIRT, 10);
    await deliver(bea, HOODIE, 4);
    await sellAndVerify(db, bea, admin, { items: [{ sku: SHIRT, quantity: 3, unitPrice: 20 }, { sku: HOODIE, quantity: 1, unitPrice: 45 }] });
    await registerSale(db, bea, { items: [{ sku: SHIRT, quantity: 5, unitPrice: 20 }] }); // pendiente: no cuenta
    await invest(bea, "license", 300);
    await invest(bea, "merchandise", 250.5);
    await invest(bea, "correction", -50.5);

    const s = await summary(bea);
    assert.equal(Number(s.units_sold), 4);
    assert.equal(Number(s.revenue), 105);
    assert.equal(Number(s.units_delivered), 14);
    assert.equal(Number(s.stock_balance), 10);
    assert.equal(Number(s.investment), 500);
    const current = s.monthly.at(-1)!;
    assert.equal(Number(current.revenue), 105);
    assert.equal(Number(current.units), 4);
  });

  it("muestra el rango cuando los niveles están configurados", async () => {
    const caro = await createLicensee(db, "caro@test.com");
    await db.sql(`update public.user_levels set minimum_xp = 0, status = 'active' where position = 1`);
    await db.sql(`update public.user_levels set minimum_xp = 500, status = 'active' where position = 2`);
    await db.sql(
      `insert into public.xp_ledger (user_id, amount, transaction_type, description, idempotency_key, created_by)
       values ($1, 120, 'admin_adjustment', 'Prueba', 'test-caro', $2)`,
      [caro, admin],
    );
    const s = await summary(caro);
    assert.equal(Number(s.total_xp), 120);
    assert.equal(s.level?.name, "Aspirante");
    assert.equal(s.next_level?.name, "Emprendedor");
    assert.equal(Number(s.next_level?.minimum_xp), 500);
  });
});

describe("Seguridad de la tienda", () => {
  it("un licenciado no ve el resumen ni los registros de otra tienda", async () => {
    const dani = await createLicensee(db, "dani@test.com");
    const eva = await createLicensee(db, "eva@test.com");
    await deliver(eva, SHIRT, 2);
    await invest(eva, "license", 100);
    await assert.rejects(summary(dani, eva), /otra tienda/);
    assert.equal((await db.as(dani, `select id from public.store_stock_movements where licensee_id = $1`, [eva])).length, 0);
    assert.equal((await db.as(dani, `select id from public.store_investments where licensee_id = $1`, [eva])).length, 0);
    assert.equal((await db.as(eva, `select id from public.store_investments where licensee_id = $1`, [eva])).length, 1);
    // El administrador sí puede ver el resumen.
    assert.equal(Number((await summary(admin, eva)).investment), 100);
  });

  it("solo el administrador registra inventario e inversiones, y quedan auditados", async () => {
    const fer = await createLicensee(db, "fer@test.com");
    await assert.rejects(
      db.as(fer, `select public.record_stock_movement($1, $2, 'delivery', 5, null)`, [fer, await productId(db, SHIRT)]),
      /administrador/,
    );
    await assert.rejects(db.as(fer, `select public.record_store_investment($1, 'license', 100, current_date, null)`, [fer]), /administrador/);
    await assert.rejects(
      db.as(fer, `insert into public.store_investments (licensee_id, concept, amount, invested_at, created_by) values ($1, 'license', 1, current_date, $1)`, [fer]),
      /permission denied/,
    );
    await invest(fer, "license", 80);
    const audit = await db.sql(`select 1 from public.audit_log where action = 'store.investment' and entity_id = $1`, [fer]);
    assert.equal(audit.length, 1);
  });

  it("los registros no se modifican y respetan sus reglas", async () => {
    const gabi = await createLicensee(db, "gabi@test.com");
    const solicitante = await createUser(db, "sol@test.com");
    await assert.rejects(deliver(gabi, SHIRT, -2), /check/);
    await assert.rejects(invest(gabi, "license", -10), /check/);
    await assert.rejects(invest(gabi, "license", 10, "2999-01-01"), /futuro/);
    await assert.rejects(invest(solicitante, "license", 10), /licenciado/);
    await invest(gabi, "license", 10);
    await assert.rejects(db.sql(`update public.store_investments set amount = 1 where licensee_id = $1`, [gabi]), /solo inserción/);
  });

  it("las ventas verificadas sin entrega registrada dejan existencias negativas visibles", async () => {
    const hugo = await createLicensee(db, "hugo@test.com");
    await sellAndVerify(db, hugo, admin, { items: [{ sku: SHIRT, quantity: 2 }] });
    assert.equal(Number((await summary(hugo)).stock_balance), -2);
  });
});
