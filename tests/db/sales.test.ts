import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createLicensee, createUser, freshDb, registerSale, verifySale, type Db } from "./helpers";

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

describe("Ventas manuales (anteriores al punto de venta)", () => {
  it("el registro manual ya no está disponible desde la API", async () => {
    await assert.rejects(
      db.as(ana, `select public.create_sale('X-1', now(), 'instagram', null, null, '[]'::jsonb)`),
      /permission denied/,
    );
  });

  it("un solicitante sin licencia activa no puede registrar ventas", async () => {
    const applicant = await createUser(db, "solicitante@test.com");
    await assert.rejects(registerSale(db, applicant), /licencia activa/);
  });

  it("la venta se registra pendiente y la referencia no puede repetirse", async () => {
    const id = await registerSale(db, ana, { reference: "IG-001" });
    const [s] = await db.sql<{ status: string }>(`select status from public.sales where id = $1`, [id]);
    assert.equal(s.status, "pending");
    await assert.rejects(registerSale(db, ana, { reference: "ig 001" }), /referencia/);
    // Otro licenciado sí puede usar su propia referencia igual.
    await registerSale(db, beto, { reference: "IG-001" });
  });

  it("rechaza fechas futuras o demasiado antiguas", async () => {
    await assert.rejects(registerSale(db, ana, { soldAt: new Date(Date.now() + 86400000) }), /futuro/);
    await assert.rejects(registerSale(db, ana, { soldAt: new Date(Date.now() - 90 * 86400000) }), /60 días/);
  });

  it("solo un administrador verifica, y nunca sus propias ventas", async () => {
    const id = await registerSale(db, ana);
    await assert.rejects(db.as(ana, `select public.review_sale($1, true)`, [id]), /administrador/);
    await assert.rejects(db.as(beto, `select public.review_sale($1, true)`, [id]), /administrador/);
    await verifySale(db, admin, id);
    await assert.rejects(verifySale(db, admin, id), /ya fue revisada/);

    // Un admin con licencia no puede verificar sus propias ventas.
    const adminLicensee = await createLicensee(db, "admin2@test.com");
    await db.sql(`update public.profiles set role = 'admin' where id = $1`, [adminLicensee]);
    const own = await registerSale(db, adminLicensee);
    await assert.rejects(verifySale(db, adminLicensee, own), /propias ventas/);
  });

  it("el rechazo exige motivo", async () => {
    const id = await registerSale(db, ana);
    await assert.rejects(db.as(admin, `select public.review_sale($1, false, '')`, [id]), /motivo/);
    await db.as(admin, `select public.review_sale($1, false, 'Referencia ilegible')`, [id]);
  });

  it("el licenciado solo anula ventas pendientes; el admin puede anular verificadas", async () => {
    const pending = await registerSale(db, ana);
    await db.as(ana, `select public.cancel_sale($1, 'Error de carga')`, [pending]);
    const verified = await registerSale(db, ana);
    await verifySale(db, admin, verified);
    await assert.rejects(db.as(ana, `select public.cancel_sale($1, 'Quiero anular')`, [verified]), /pendientes/);
    await assert.rejects(db.as(beto, `select public.cancel_sale($1, 'Ajena')`, [verified]), /No autorizado/);
    await db.as(admin, `select public.cancel_sale($1, 'Devolución')`, [verified]);
  });

  it("no se puede escribir en ventas sin pasar por las funciones", async () => {
    await assert.rejects(
      db.as(ana, `update public.sales set status = 'verified' where licensee_id = $1`, [ana]),
      /permission denied/,
    );
    await assert.rejects(
      db.as(ana, `insert into public.sales (licensee_id, reference, sold_at, channel) values ($1, 'X', now(), 'otro')`, [ana]),
      /permission denied/,
    );
  });

  it("cada licenciado ve solo sus ventas", async () => {
    const mine = await db.as<{ licensee_id: string }>(ana, `select licensee_id from public.sales`);
    assert.ok(mine.length > 0);
    assert.ok(mine.every((s) => s.licensee_id === ana));
    const items = await db.as<{ sale_id: string }>(beto, `select i.sale_id from public.sale_items i join public.sales s on s.id = i.sale_id where s.licensee_id = $1`, [ana]);
    assert.equal(items.length, 0);
  });
});
