import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  HOODIE,
  SHIRT,
  createLicensee,
  createUser,
  freshDb,
  issueUnits,
  participation,
  posCheckout,
  productId,
  refresh,
  sellAndVerify,
  xpTotal,
  type Db,
} from "./helpers";

let db: Db;
let admin: string;
let ana: string;
let beto: string;

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
  ana = await createLicensee(db, "ana@test.com");
  beto = await createLicensee(db, "beto@test.com");
});
after(() => db.close());

const summary = async (userId: string) => {
  const [r] = await db.as<{ s: { units_sold: number; revenue: number; stock_balance: number } }>(
    userId,
    `select public.store_summary($1) as s`,
    [userId],
  );
  return r.s;
};
const unit = async (code: string) => {
  const [u] = await db.sql<{ status: string; sale_id: string | null }>(`select status, sale_id from public.garment_units where code = $1`, [code]);
  return u;
};

describe("Etiquetas QR", () => {
  it("el administrador emite prendas con QR únicos y registra la entrega en el inventario", async () => {
    const before = await summary(ana);
    const codes = await issueUnits(db, admin, ana, { quantity: 3, price: 30 });
    assert.equal(codes.length, 3);
    assert.equal(new Set(codes).size, 3);
    for (const c of codes) assert.match(c, /^GN-[0-9A-HJKMNP-TV-Z]{8}$/);
    const after = await summary(ana);
    assert.equal(after.stock_balance - before.stock_balance, 3);
    const audit = await db.sql(`select 1 from public.audit_log where action = 'garment_units.issued' and entity_id = $1`, [ana]);
    assert.equal(audit.length, 1);
  });

  it("etiquetar stock ya entregado no puede superar las prendas sin QR", async () => {
    const product = await productId(db, HOODIE);
    await db.as(admin, `select public.record_stock_movement($1, $2, 'delivery', 2, 'Entrega sin QR')`, [beto, product]);
    await assert.rejects(issueUnits(db, admin, beto, { sku: HOODIE, quantity: 3, delivery: false }), /2 prendas/);
    const codes = await issueUnits(db, admin, beto, { sku: HOODIE, quantity: 2, delivery: false });
    assert.equal(codes.length, 2);
    await assert.rejects(issueUnits(db, admin, beto, { sku: HOODIE, quantity: 1, delivery: false }), /0 prendas/);
  });

  it("solo un administrador emite etiquetas, con precio y para una tienda licenciada", async () => {
    await assert.rejects(issueUnits(db, ana, ana), /administrador/);
    const applicant = await createUser(db, "sol@test.com");
    await assert.rejects(issueUnits(db, admin, applicant), /licenciado/);
    const product = await productId(db, SHIRT);
    await assert.rejects(
      db.as(admin, `select public.issue_garment_units($1, $2, 1, null, true, null)`, [ana, product]),
      /precio/,
    );
  });

  it("nadie escribe directamente en las prendas y cada tienda ve solo las suyas", async () => {
    await assert.rejects(db.as(ana, `update public.garment_units set status = 'in_store'`), /permission denied/);
    await assert.rejects(db.as(ana, `delete from public.garment_units`), /permission denied/);
    const mine = await db.as<{ licensee_id: string }>(ana, `select licensee_id from public.garment_units`);
    assert.ok(mine.length > 0 && mine.every((u) => u.licensee_id === ana));
    assert.equal((await db.anon(`select 1 from public.garment_units`).catch(() => [])).length, 0);
  });
});

describe("Punto de venta", () => {
  it("consulta una prenda por código, en minúsculas o desde la URL del QR", async () => {
    const [code] = await issueUnits(db, admin, ana, { price: 42.5 });
    const [r] = await db.as<{ r: { code: string; unit_price: number } }>(ana, `select public.pos_lookup($1) as r`, [code.toLowerCase()]);
    assert.equal(r.r.code, code);
    assert.equal(Number(r.r.unit_price), 42.5);
    await db.as(ana, `select public.pos_lookup($1)`, [`https://gallonegro.app/panel/ventas?codigo=${code}`]);
    await assert.rejects(db.as(beto, `select public.pos_lookup($1)`, [code]), /no está registrada en tu tienda/);
    await assert.rejects(db.as(ana, `select public.pos_lookup('hola')`), /no es un QR/);
  });

  it("cerrar la venta la verifica al instante, saca la prenda del stock y da XP de misiones", async () => {
    const u = await createLicensee(db, "pos1@test.com");
    const codes = await issueUnits(db, admin, u, { quantity: 2, price: 25 });
    await refresh(db, u);
    const before = await summary(u);

    const saleId = await posCheckout(db, u, codes, "@cliente");
    const [s] = await db.sql<{ status: string; source: string; reference: string; verified_by: string | null }>(
      `select status, source, reference, verified_by from public.sales where id = $1`,
      [saleId],
    );
    assert.equal(s.status, "verified");
    assert.equal(s.source, "pos");
    assert.equal(s.verified_by, null);
    assert.match(s.reference, /^POS-\d{8}-\d{6}-/);
    const items = await db.sql<{ quantity: number; unit_price: string; garment_unit_id: string }>(
      `select quantity, unit_price, garment_unit_id from public.sale_items where sale_id = $1`,
      [saleId],
    );
    assert.equal(items.length, 2);
    assert.ok(items.every((i) => i.quantity === 1 && Number(i.unit_price) === 25 && i.garment_unit_id));
    for (const c of codes) assert.deepEqual(await unit(c), { status: "sold", sale_id: saleId });

    const after = await summary(u);
    assert.equal(after.units_sold - before.units_sold, 2);
    assert.equal(Number(after.revenue) - Number(before.revenue), 50);
    assert.equal(after.stock_balance - before.stock_balance, -2);

    // D01 (primera venta del día) se completa sin intervención del administrador.
    assert.equal((await participation(db, u, "D01")).status, "completed");
    assert.ok((await xpTotal(db, u)) >= 100);
    const audit = await db.sql(`select 1 from public.audit_log where action = 'sale.pos_checkout' and entity_id = $1`, [saleId]);
    assert.equal(audit.length, 1);
  });

  it("un QR no se vende dos veces ni se repite en la misma venta", async () => {
    const [a, b] = await issueUnits(db, admin, ana, { quantity: 2 });
    await assert.rejects(posCheckout(db, ana, [a, a.toLowerCase()]), /repetida/);
    await posCheckout(db, ana, [a]);
    await assert.rejects(posCheckout(db, ana, [b, a]), /ya no está disponible/);
    // La venta fallida no dejó nada a medias.
    assert.equal((await unit(b)).status, "in_store");
    await assert.rejects(db.as(ana, `select public.pos_lookup($1)`, [a]), /ya se vendió/);
  });

  it("no se venden prendas de otra tienda ni sin licencia activa", async () => {
    const [code] = await issueUnits(db, admin, beto);
    await assert.rejects(posCheckout(db, ana, [code]), /no está registrada en tu tienda/);
    const applicant = await createUser(db, "sinlic@test.com");
    await assert.rejects(posCheckout(db, applicant, [code]), /licencia activa/);
    await assert.rejects(posCheckout(db, ana, []), /al menos una prenda/);
    assert.equal((await unit(code)).status, "in_store");
  });

  it("dos cajas que cierran la misma prenda a la vez: solo una venta la consigue", async () => {
    const [code] = await issueUnits(db, admin, ana);
    const results = await Promise.allSettled([freshCheckout(code), freshCheckout(code)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const sold = await db.sql(`select 1 from public.sale_items i join public.garment_units u on u.id = i.garment_unit_id
                               join public.sales s on s.id = i.sale_id where u.code = $1 and s.status = 'verified'`, [code]);
    assert.equal(sold.length, 1);
  });

  it("anular libera las prendas; el licenciado solo puede hacerlo en los primeros 15 minutos", async () => {
    const [code] = await issueUnits(db, admin, ana);
    const saleId = await posCheckout(db, ana, [code]);
    await db.as(ana, `select public.cancel_sale($1, 'Error de caja')`, [saleId]);
    assert.deepEqual(await unit(code), { status: "in_store", sale_id: null });

    // El mismo QR puede venderse de nuevo; el historial de la venta anulada se conserva.
    const again = await posCheckout(db, ana, [code]);
    const lines = await db.sql(`select 1 from public.sale_items i join public.garment_units u on u.id = i.garment_unit_id where u.code = $1`, [code]);
    assert.equal(lines.length, 2);

    await db.sql(`update public.sales set created_at = now() - interval '20 minutes' where id = $1`, [again]);
    await assert.rejects(db.as(ana, `select public.cancel_sale($1, 'Tarde')`, [again]), /15 minutos/);
    await assert.rejects(db.as(beto, `select public.cancel_sale($1, 'Ajena')`, [again]), /No autorizado/);
    await db.as(admin, `select public.cancel_sale($1, 'Devolución del cliente')`, [again]);
    assert.equal((await unit(code)).status, "in_store");
  });

  it("devolver una prenda a Gallo Negro la saca del stock y su QR deja de venderse", async () => {
    const [code] = await issueUnits(db, admin, beto);
    const before = await summary(beto);
    await assert.rejects(db.as(beto, `select public.return_garment_unit($1, null)`, [code]), /administrador/);
    await db.as(admin, `select public.return_garment_unit($1, 'Talla equivocada')`, [code]);
    assert.equal((await unit(code)).status, "returned");
    assert.equal((await summary(beto)).stock_balance - before.stock_balance, -1);
    await assert.rejects(posCheckout(db, beto, [code]), /ya no está disponible/);
    await assert.rejects(db.as(admin, `select public.return_garment_unit($1, null)`, [code]), /siguen en la tienda/);
  });

  it("las ventas del punto de venta no pasan por la verificación manual", async () => {
    const [code] = await issueUnits(db, admin, ana);
    const saleId = await posCheckout(db, ana, [code]);
    await assert.rejects(db.as(admin, `select public.review_sale($1, false, 'No')`, [saleId]), /ya fue revisada/);
    // Las ventas manuales anteriores siguen pudiendo verificarse.
    await sellAndVerify(db, ana, admin);
  });
});

/** Cierra una venta desde otra conexión, para simular dos cajas a la vez. */
async function freshCheckout(code: string) {
  const { Client } = await import("pg");
  const [{ db: name }] = await db.sql<{ db: string }>(`select current_database() as db`);
  const { urlFor } = await import("./helpers");
  const c = new Client({ connectionString: urlFor(name) });
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ana, role: "authenticated" })]);
    await c.query(`select public.pos_checkout($1, 'presencial', null, null)`, [[code]]);
    await c.query("select pg_sleep(0.2)");
    await c.query("commit");
  } catch (err) {
    await c.query("rollback");
    throw err;
  } finally {
    await c.end();
  }
}
