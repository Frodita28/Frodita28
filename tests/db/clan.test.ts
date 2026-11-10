// Tienda Clan, rango con doble candado y panel admin (Fases 2 a 4).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { account, ageAndSettle, assertConsistent, createLicensee, createUser, freshDb, issueUnits, participation, posCheckout, refresh, type Db } from "./helpers";

let db: Db;
let admin: string;

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
  await db.sql(`update public.gn_config set value = '0' where key = 'canje_segundos_entre'`);
  await db.sql(`update public.gn_config set value = '50' where key = 'canjes_por_dia'`);
});
after(() => db.close());

const DELIVERY = { nombre: "Ana Pérez", telefono: "04141234567", ciudad: "Caracas", direccion: "Av. Principal 123", notas: "" };

async function tester(email = `t-${randomUUID()}@test.com`) {
  const id = await createLicensee(db, email);
  await db.sql(`update public.gn_config set value = value || to_jsonb($1::text) where key = 'recompensas_v3_testers'`, [id]);
  await db.as(id, `select public.gn_accept_terms(1)`);
  return id;
}
async function give(userId: string, gn: number) {
  await db.as(admin, `select public.gn_admin_adjust($1, $2, 'Saldo de prueba', $3)`, [userId, gn, randomUUID()]);
}
const demo = async (name: string) => (await db.sql<{ id: string }>(`select id from public.clan_products where name = $1`, [name]))[0].id;
const redeem = (userId: string, product: string, key = randomUUID(), delivery: object = DELIVERY) =>
  db.as<{ r: { ok: boolean; redemption_id: string; available_after: number } }>(userId, `select public.clan_redeem($1, $2, $3) as r`, [
    product,
    JSON.stringify(delivery),
    key,
  ]);
const setStatus = (id: string, status: string, note: string | null = null, substitute: string | null = null) =>
  db.as(admin, `select public.clan_admin_set_status($1, $2, $3, $4)`, [id, status, note, substitute]);
const rank = async (userId: string) =>
  (await db.as<{ s: { level: number; computed_level: number; sales_usd: string; xp: number } }>(userId, `select public.my_rank_state() as s`))[0].s;

describe("Interruptor y visibilidad", () => {
  it("con el interruptor apagado un licenciatario normal no ve el catálogo ni puede canjear", async () => {
    const u = await createLicensee(db, `normal-${randomUUID()}@test.com`);
    const [v] = await db.as<{ v: boolean }>(u, `select public.gn_v3_enabled() as v`);
    assert.equal(v.v, false);
    assert.equal((await db.as(u, `select * from public.clan_products`)).length, 0);
    await give(u, 100);
    await assert.rejects(redeem(u, await demo("[DEMO] Gorra")), /no está disponible|términos/);
  });

  it("los productos de demostración solo los ven los licenciatarios de prueba, aun con el interruptor encendido", async () => {
    const u = await createLicensee(db, `todos-${randomUUID()}@test.com`);
    await db.sql(`update public.gn_config set value = 'true' where key = 'recompensas_v3_activa'`);
    try {
      assert.equal((await db.as(u, `select * from public.clan_products where is_demo`)).length, 0);
      const t = await tester();
      assert.equal((await db.as(t, `select * from public.clan_products where is_demo`)).length, 3);
    } finally {
      await db.sql(`update public.gn_config set value = 'false' where key = 'recompensas_v3_activa'`);
    }
  });

  it("el licenciatario nunca ve el costo real", async () => {
    const t = await tester();
    assert.equal((await db.as(t, `select * from public.clan_product_costs`)).length, 0);
    assert.equal((await db.as(admin, `select * from public.clan_product_costs`)).length >= 3, true);
  });
});

describe("Canjes", () => {
  it("retiene los GN de inmediato y el estado avanza hasta entregado", async () => {
    const t = await tester();
    await give(t, 100);
    const [{ r }] = await redeem(t, await demo("[DEMO] Gorra"));
    assert.equal(r.available_after, 56);
    assert.deepEqual(await account(db, t), { available: 56, pending: 0, held: 44, debt: 0 });
    for (const s of ["aprobado", "en_preparacion", "enviado"]) await setStatus(r.redemption_id, s);
    await db.as(t, `select public.clan_confirm_received($1)`, [r.redemption_id]);
    assert.deepEqual(await account(db, t), { available: 56, pending: 0, held: 0, debt: 0 });
    const events = await db.sql(`select to_status from public.clan_redemption_events where redemption_id = $1 order by id`, [r.redemption_id]);
    assert.deepEqual(events.map((e) => e.to_status), ["solicitado", "aprobado", "en_preparacion", "enviado", "entregado"]);
    await assertConsistent(db, t);
  });

  it("rechazar o cancelar devuelve los GN y el stock", async () => {
    const t = await tester();
    await give(t, 100);
    const gorra = await demo("[DEMO] Gorra");
    const [{ stock: before }] = await db.sql<{ stock: number }>(`select stock from public.clan_products where id = $1`, [gorra]);
    const [{ r }] = await redeem(t, gorra);
    await assert.rejects(setStatus(r.redemption_id, "rechazado"), /motivo/);
    await setStatus(r.redemption_id, "rechazado", "Sin unidades del color");
    assert.deepEqual(await account(db, t), { available: 100, pending: 0, held: 0, debt: 0 });
    const [{ stock: after }] = await db.sql<{ stock: number }>(`select stock from public.clan_products where id = $1`, [gorra]);
    assert.equal(after, before);
    const [{ r: r2 }] = await redeem(t, gorra);
    await db.as(t, `select public.clan_cancel_my_redemption($1)`, [r2.redemption_id]);
    assert.equal((await account(db, t)).available, 100);
    await assertConsistent(db, t);
  });

  it("sustituir pide una nota", async () => {
    const t = await tester();
    await give(t, 44);
    const [{ r }] = await redeem(t, await demo("[DEMO] Gorra"));
    await setStatus(r.redemption_id, "aprobado");
    await assert.rejects(setStatus(r.redemption_id, "sustituido"), /sustituye/);
    await setStatus(r.redemption_id, "sustituido", null, "Gorra negra en lugar de roja");
    await assert.rejects(setStatus(r.redemption_id, "solicitado"), /No se puede pasar/);
  });

  it("el doble toque con la misma clave crea un solo canje", async () => {
    const t = await tester();
    await give(t, 100);
    const key = randomUUID();
    const gorra = await demo("[DEMO] Gorra");
    await redeem(t, gorra, key);
    const [{ r }] = await redeem(t, gorra, key);
    assert.equal((r as unknown as { repeated: boolean }).repeated, true);
    assert.equal((await account(db, t)).available, 56);
  });

  it("dos canjes del mismo saldo: el segundo falla por saldo", async () => {
    const t = await tester();
    await give(t, 60);
    const gorra = await demo("[DEMO] Gorra");
    await redeem(t, gorra);
    await assert.rejects(redeem(t, gorra), /Te faltan 28 GN/);
    await assertConsistent(db, t);
  });

  it("dos canjes simultáneos desde dos conexiones no gastan el mismo saldo", async () => {
    const t = await tester();
    await give(t, 60);
    const gorra = await demo("[DEMO] Gorra");
    const results = await Promise.allSettled([redeem(t, gorra), db.fork().then((d2) => redeemWith(d2, t, gorra))]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await account(db, t)).available, 16);
    await assertConsistent(db, t);
  });

  it("con saldo 0 no se puede canjear", async () => {
    const t = await tester();
    await assert.rejects(redeem(t, await demo("[DEMO] Gorra")), /Te faltan 44 GN/);
  });

  it("sin aceptar los términos no se puede canjear", async () => {
    const u = await createLicensee(db, `terminos-${randomUUID()}@test.com`);
    await db.sql(`update public.gn_config set value = value || to_jsonb($1::text) where key = 'recompensas_v3_testers'`, [u]);
    await give(u, 100);
    await assert.rejects(redeem(u, await demo("[DEMO] Gorra")), /términos/);
    await db.as(u, `select public.gn_accept_terms(1)`);
    await redeem(u, await demo("[DEMO] Gorra"));
  });

  it("un premio de un rango superior está bloqueado aunque haya saldo", async () => {
    const t = await tester();
    await give(t, 5000);
    await assert.rejects(redeem(t, await demo("[DEMO] Consola PS5")), /rango superior/);
  });

  it("pide los datos de entrega y respeta el límite por licenciatario", async () => {
    const t = await tester();
    await give(t, 1000);
    const gorra = await demo("[DEMO] Gorra");
    await assert.rejects(redeem(t, gorra, randomUUID(), { ...DELIVERY, direccion: "" }), /dirección/);
    for (let i = 0; i < 3; i++) await redeem(t, gorra);
    await assert.rejects(redeem(t, gorra), /máximo de veces/);
  });

  it("limita la frecuencia de canjes", async () => {
    const t = await tester();
    await give(t, 1000);
    await db.sql(`update public.gn_config set value = '1' where key = 'canjes_por_dia'`);
    try {
      await redeem(t, await demo("[DEMO] Gorra"));
      await assert.rejects(redeem(t, await demo("[DEMO] Gorra")), /máximo de canjes por día/);
    } finally {
      await db.sql(`update public.gn_config set value = '50' where key = 'canjes_por_dia'`);
    }
  });

  it("al alcanzar el tope mensual de costo el catálogo se pausa", async () => {
    const t = await tester();
    await give(t, 1000);
    await db.as(admin, `select public.gn_set_config('tope_mensual_canjes_usd', '1')`);
    try {
      await assert.rejects(redeem(t, await demo("[DEMO] Gorra")), /pausa/);
    } finally {
      await db.as(admin, `select public.gn_set_config('tope_mensual_canjes_usd', 'null')`);
    }
  });

  it("una venta que se anula después de un canje deja saldo por cubrir y bloquea nuevos canjes", async () => {
    const t = await tester();
    const codes = await issueUnits(db, admin, t, { quantity: 4, price: 35 });
    const sale = await posCheckout(db, t, codes);
    await ageAndSettle(db, t);
    // 4 prendas × 12 + 12 de la primera venta del día = 60.
    assert.equal((await account(db, t)).available, 60);
    await redeem(t, await demo("[DEMO] Gorra"));
    await db.as(admin, `select public.gn_return_sale($1, 'Devolución del cliente')`, [sale]);
    const a = await account(db, t);
    assert.equal(a.available, 0);
    assert.equal(a.debt, 44);
    assert.equal(a.held, 44, "el canje en curso sigue retenido");
    await give(t, 10);
    await assert.rejects(redeem(t, await demo("[DEMO] Gorra")), /por cubrir/);
    await assertConsistent(db, t);
  });

  it("un premio que sale del catálogo no afecta los GN guardados", async () => {
    const t = await tester();
    await give(t, 500);
    const gorra = await demo("[DEMO] Gorra");
    await db.as(admin, `select public.clan_admin_save_product($1)`, [
      JSON.stringify({ id: gorra, name: "[DEMO] Gorra", tier: "calle", price_gn: 44, stock: 50, limit_per_user: 3, is_permanent: true, status: "archivado", kind: "fisico" }),
    ]);
    assert.equal((await db.as(t, `select * from public.clan_products where id = $1`, [gorra])).length, 0);
    assert.equal((await account(db, t)).available, 500);
    await db.as(admin, `select public.clan_admin_save_product($1)`, [
      JSON.stringify({ id: gorra, name: "[DEMO] Gorra", tier: "calle", price_gn: 44, stock: 50, limit_per_user: 3, is_permanent: true, status: "activo", kind: "fisico" }),
    ]);
  });

  it("los GN devueltos de un canje conservan su fecha de vencimiento y vencen si ya pasó", async () => {
    const t = await tester();
    await give(t, 44);
    const [{ r }] = await redeem(t, await demo("[DEMO] Gorra"));
    await db.sql(`update public.gn_lots set expires_at = now() - interval '1 day', available_at = now() - interval '13 months' where user_id = $1`, [t]);
    await setStatus(r.redemption_id, "rechazado", "Prueba de vencimiento");
    const a = await account(db, t);
    assert.equal(a.available, 0);
    const [v] = await db.sql<{ n: number }>(`select count(*)::int as n from public.gn_ledger where user_id = $1 and kind = 'vencimiento'`, [t]);
    assert.equal(v.n, 1);
    await assertConsistent(db, t);
  });

  it("avisa los GN por vencer a los 60 y 30 días", async () => {
    const t = await tester();
    await give(t, 30);
    await db.sql(`update public.gn_lots set expires_at = now() + interval '20 days' where user_id = $1`, [t]);
    await db.sql(`select public.gn_settle($1)`, [t]);
    await db.sql(`select public.gn_settle($1)`, [t]);
    const n = await db.sql<{ kind: string }>(`select kind from public.notifications where user_id = $1 and kind = 'gn_por_vencer'`, [t]);
    assert.equal(n.length, 2, "un aviso de 60 y otro de 30 días, sin repetirse");
    const [s] = await db.as<{ s: { expiring_30: number } }>(t, `select public.my_gn_summary() as s`);
    assert.equal(s.s.expiring_30, 30);
  });
});

describe("Rango con doble candado", () => {
  it("un licenciatario sin ventas queda en Umbral aunque tenga XP", async () => {
    const t = await tester();
    await db.as(admin, `select public.admin_adjust_xp($1, 2500, 'XP de prueba', $2)`, [t, randomUUID()]);
    const s = await rank(t);
    assert.equal(s.xp, 2500);
    assert.equal(s.level, 1);
  });

  it("sube con XP, ventas verificadas e identidad, y nunca baja", async () => {
    const t = await tester();
    await db.as(admin, `select public.admin_adjust_xp($1, 2500, 'XP de prueba', $2)`, [t, randomUUID()]);
    // 43 prendas × $35 = $1.505 en ventas verificadas.
    for (let i = 0; i < 3; i++) {
      const codes = await issueUnits(db, admin, t, { quantity: 15, price: 35 });
      await posCheckout(db, t, codes.slice(0, i < 2 ? 15 : 13));
    }
    // Un primer día de 43 prendas es un pico fuera de su historial: el admin lo aprueba.
    const review = await db.sql<{ sale_id: string }>(`select sale_id from public.gn_sale_holds where licensee_id = $1 and status = 'en_revision'`, [t]);
    assert.ok(review.length > 0);
    for (const h of review) await db.as(admin, `select public.gn_review_sale($1, true, 'Feria del barrio')`, [h.sale_id]);
    await ageAndSettle(db, t);
    assert.equal(Number((await rank(t)).sales_usd), 1505);
    assert.equal((await rank(t)).level, 1, "falta el módulo ADN");
    await db.as(admin, `select public.admin_set_identity($1, 'VIGIA_ADN', true)`, [t]);
    assert.equal((await rank(t)).level, 2);
    const notes = await db.sql(`select 1 from public.notifications where user_id = $1 and kind = 'subida_rango'`, [t]);
    assert.equal(notes.length, 1);
    // Restar XP no baja el rango.
    await db.as(admin, `select public.admin_adjust_xp($1, -2500, 'Corrección', $2)`, [t, randomUUID()]);
    const s = await rank(t);
    assert.equal(s.computed_level, 1);
    assert.equal(s.level, 2);
  });

  it("la venta cuenta para el rango con su PVP oficial, no con el precio de la etiqueta", async () => {
    const t = await tester();
    const codes = await issueUnits(db, admin, t, { quantity: 1, price: 20 });
    await posCheckout(db, t, codes);
    await db.sql(`update public.gn_sale_holds set status = 'en_espera' where licensee_id = $1`, [t]);
    await ageAndSettle(db, t);
    assert.equal(Number((await rank(t)).sales_usd), 35);
  });
});

describe("Panel admin", () => {
  it("solo el administrador usa las funciones del panel", async () => {
    const t = await tester();
    await assert.rejects(db.as(t, `select public.admin_gn_dashboard()`), /administrador/);
    await assert.rejects(db.as(t, `select public.clan_admin_save_product('{}'::jsonb)`), /administrador/);
    await assert.rejects(db.as(t, `select public.gn_set_config('gn_por_unidad', '99')`), /administrador/);
    await assert.rejects(db.as(t, `select public.admin_set_identity($1, 'VIGIA_ADN', true)`, [t]), /administrador/);
  });

  it("crea un producto con su costo, lo duplica a otra edición y queda auditado", async () => {
    const [{ id: edition }] = await db.as<{ id: string }>(admin, `select public.clan_admin_save_edition('2026-12-01', 'Diciembre', 'borrador', null) as id`);
    const [{ id }] = await db.as<{ id: string }>(admin, `select public.clan_admin_save_product($1) as id`, [
      JSON.stringify({ name: "Audífonos", tier: "medio", price_gn: 600, cost_usd: 40, status: "activo", edition_id: edition }),
    ]);
    const [p] = await db.sql<{ min_rank: number }>(`select min_rank from public.clan_products where id = $1`, [id]);
    assert.equal(p.min_rank, 2, "Medio = Vigía por defecto");
    const [{ id: copy }] = await db.as<{ id: string }>(admin, `select public.clan_admin_duplicate_product($1, $2) as id`, [id, edition]);
    const [c] = await db.sql<{ status: string; cost_usd: string }>(
      `select p.status, c.cost_usd from public.clan_products p join public.clan_product_costs c on c.product_id = p.id where p.id = $1`,
      [copy],
    );
    assert.deepEqual({ status: c.status, cost: Number(c.cost_usd) }, { status: "borrador", cost: 40 });
    const audit = await db.sql(`select 1 from public.audit_log where entity_type = 'clan_product' and entity_id in ($1, $2)`, [id, copy]);
    assert.equal(audit.length, 2);
    // Un producto de una edición no publicada no se ve.
    const t = await tester();
    assert.equal((await db.as(t, `select * from public.clan_products where id = $1`, [id])).length, 0);
    await db.as(admin, `select public.clan_admin_save_edition('2026-12-01', 'Diciembre', 'publicado', null)`);
    assert.equal((await db.as(t, `select * from public.clan_products where id = $1`, [id])).length, 1);
  });

  it("el resumen calcula el costo real de los canjes entregados sobre las ventas del mes", async () => {
    const t = await tester();
    const codes = await issueUnits(db, admin, t, { quantity: 4, price: 35 });
    await posCheckout(db, t, codes);
    await ageAndSettle(db, t);
    const [{ r }] = await redeem(t, await demo("[DEMO] Gorra"));
    for (const s of ["aprobado", "enviado", "entregado"]) await setStatus(r.redemption_id, s);
    const [{ d }] = await db.as<{ d: { cost_delivered_usd: string; verified_sales_usd: string; cost_pct: string; profit_before_usd: string } }>(
      admin,
      `select public.admin_gn_dashboard() as d`,
    );
    assert.ok(Number(d.cost_delivered_usd) >= 8);
    assert.ok(Number(d.verified_sales_usd) >= 140);
    assert.ok(Number(d.cost_pct) > 0);
    assert.equal(Number(d.profit_before_usd), 10);
  });

  it("validación de misiones: en revisión, requiere corrección y aprobación con GN", async () => {
    const u = await tester();
    await refresh(db, u);
    const p = await participation(db, u, "D02");
    const sub = async () =>
      (await db.as<{ res: { evidence_id: string } }>(u, `select public.submit_mission_evidence($1, $2) as res`, [p.id, `https://instagram.com/reel/${randomUUID()}`]))[0]
        .res.evidence_id;
    const e1 = await sub();
    await db.as(admin, `select public.admin_start_evidence_review($1)`, [e1]);
    await db.as(admin, `select public.admin_decide_evidence($1, 'corregir', 'Falta mostrar la etiqueta')`, [e1]);
    const [ev] = await db.sql<{ status: string; needs_changes: boolean }>(`select status, needs_changes from public.mission_evidences where id = $1`, [e1]);
    assert.deepEqual(ev, { status: "rejected", needs_changes: true });
    const e2 = await sub();
    await db.as(admin, `select public.admin_decide_evidence($1, 'aprobar')`, [e2]);
    assert.equal((await account(db, u)).available, 4);
  });

  it("límite semanal de evidencias por tipo", async () => {
    const u = await tester();
    await refresh(db, u);
    await db.as(admin, `select public.admin_save_validation_rule('Contenido', 'Reel original', 1, 72)`);
    try {
      const p = await participation(db, u, "D02");
      await db.as(u, `select public.submit_mission_evidence($1, $2)`, [p.id, `https://instagram.com/reel/${randomUUID()}`]);
      const s = await participation(db, u, "S02");
      await assert.rejects(db.as(u, `select public.submit_mission_evidence($1, $2)`, [s.id, `https://instagram.com/reel/${randomUUID()}`]), /límite semanal/);
    } finally {
      await db.as(admin, `select public.admin_save_validation_rule('Contenido', 'Reel original', null, 72)`);
    }
  });

  it("los ajustes de configuración quedan auditados", async () => {
    await db.as(admin, `select public.gn_set_config('gn_por_unidad', '12')`);
    const rows = await db.sql(`select 1 from public.audit_log where action = 'gn.config_changed' and entity_id = 'gn_por_unidad'`);
    assert.ok(rows.length >= 1);
  });
});

async function redeemWith(d: Db, userId: string, product: string) {
  try {
    return await d.as(userId, `select public.clan_redeem($1, $2, $3) as r`, [product, JSON.stringify(DELIVERY), randomUUID()]);
  } finally {
    await d.closeFork();
  }
}
