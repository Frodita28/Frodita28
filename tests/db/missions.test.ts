import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  HOODIE,
  SHIRT,
  createLicensee,
  createUser,
  freshDb,
  participation,
  refresh,
  registerSale,
  sellAndVerify,
  xpTotal,
  type Db,
} from "./helpers";

let db: Db;
let admin: string;

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
});
after(() => db.close());

async function submitEvidence(userId: string, participationId: string, url: string) {
  const [r] = await db.as<{ res: { ok: boolean; error?: string; evidence_id?: string } }>(
    userId,
    `select public.submit_mission_evidence($1, $2) as res`,
    [participationId, url],
  );
  return r.res;
}

async function review(evidenceId: string, approve: boolean, reason?: string) {
  const [r] = await db.as<{ status: string }>(
    admin,
    `select public.review_mission_evidence($1, $2, $3) as status`,
    [evidenceId, approve, reason ?? null],
  );
  return r.status;
}

describe("Participaciones y períodos", () => {
  it("un licenciado recibe una participación por misión activa; las inactivas no aparecen", async () => {
    const u = await createLicensee(db, "p1@test.com");
    await refresh(db, u);
    const rows = await db.as<{ code: string }>(
      u,
      `select m.code from public.mission_participations p join public.missions m on m.id = p.mission_id`,
    );
    const codes = rows.map((r) => r.code).sort();
    assert.ok(codes.includes("D01") && codes.includes("S01") && codes.includes("M10"));
    for (const inactive of ["D07", "D08", "S08", "S09"]) assert.ok(!codes.includes(inactive), inactive);
    // D09 "La segunda oportunidad" se retiró el 2026-10-22.
    assert.ok(!codes.includes("D09"));
    assert.equal(codes.length, 25);
  });

  it("refrescar varias veces no duplica participaciones", async () => {
    const u = await createLicensee(db, "p2@test.com");
    await refresh(db, u);
    await refresh(db, u);
    const [c] = await db.sql<{ n: string }>(`select count(*) as n from public.mission_participations where user_id = $1`, [u]);
    assert.equal(Number(c.n), 25);
  });

  it("un solicitante sin licencia no recibe misiones ni las ve", async () => {
    const u = await createUser(db, "nolic@test.com");
    await refresh(db, u);
    const missions = await db.as(u, `select id from public.missions`);
    assert.equal(missions.length, 0);
    const parts = await db.sql(`select id from public.mission_participations where user_id = $1`, [u]);
    assert.equal(parts.length, 0);
  });

  it("respeta la restricción por plan y territorio", async () => {
    await db.as(
      admin,
      `insert into public.missions (code, title, category, frequency, target_value, target_unit, metric, xp_reward, validation_method, status, applicable_license_plans, territory_rules)
       select 'X_PLAN2', 'Solo plan 2 en Valencia', 'Ventas', 'daily', 1, 'venta', 'verified_sales_count', 10, 'auto', 'active', array[id], array['Valencia']
       from public.license_plans where code = 'PLAN_2'`,
    );
    const plan1 = await createLicensee(db, "plan1@test.com", "PLAN_1", "Valencia");
    const plan2Caracas = await createLicensee(db, "plan2c@test.com", "PLAN_2", "Caracas");
    const plan2Valencia = await createLicensee(db, "plan2v@test.com", "PLAN_2", "valencia");
    for (const u of [plan1, plan2Caracas, plan2Valencia]) await refresh(db, u);
    assert.equal(await participation(db, plan1, "X_PLAN2"), undefined);
    assert.equal(await participation(db, plan2Caracas, "X_PLAN2"), undefined);
    assert.ok(await participation(db, plan2Valencia, "X_PLAN2"));
    const visible = await db.as(plan1, `select id from public.missions where code = 'X_PLAN2'`);
    assert.equal(visible.length, 0);
    await db.as(admin, `update public.missions set status = 'inactive' where code = 'X_PLAN2'`);
  });

  it("el objetivo puede ajustarse por plan y queda fijado en la participación", async () => {
    await db.as(
      admin,
      `update public.missions set plan_targets = jsonb_build_object((select id from public.license_plans where code = 'PLAN_3')::text, 3)
       where code = 'S06'`,
    );
    const u = await createLicensee(db, "plan3@test.com", "PLAN_3");
    await refresh(db, u);
    assert.equal(Number((await participation(db, u, "S06")).target_value), 3);
    await db.as(admin, `update public.missions set plan_targets = '{}' where code = 'S06'`);
  });

  it("un período nuevo crea otra participación y conserva el historial y los XP", async () => {
    const u = await createLicensee(db, "periodo@test.com");
    // Participación completada de hace 10 días (fuera del plazo de revisión).
    await db.sql(
      `insert into public.mission_participations (mission_id, user_id, period_start, period_end, target_value, xp_reward, current_progress, status, completed_at)
       select id, $1, current_date - 10, current_date - 10, 1, 100, 1, 'completed', now() - interval '10 days' from public.missions where code = 'D01'`,
      [u],
    );
    await db.sql(
      `insert into public.xp_ledger (user_id, amount, transaction_type, mission_id, participation_id, description, idempotency_key)
       select p.user_id, 100, 'mission_reward', p.mission_id, p.id, 'histórico', 'mission_reward:' || p.id
       from public.mission_participations p where p.user_id = $1`,
      [u],
    );
    // Participación sin completar de hace 10 días: debe vencer.
    await db.sql(
      `insert into public.mission_participations (mission_id, user_id, period_start, period_end, target_value, xp_reward)
       select id, $1, current_date - 10, current_date - 10, 1, 80 from public.missions where code = 'D02'`,
      [u],
    );
    await refresh(db, u);
    const d01 = await db.sql<{ status: string }>(
      `select p.status from public.mission_participations p join public.missions m on m.id = p.mission_id
       where p.user_id = $1 and m.code = 'D01' order by p.period_start`,
      [u],
    );
    assert.deepEqual(d01.map((r) => r.status), ["completed", "available"]);
    const d02 = await db.sql<{ status: string }>(
      `select p.status from public.mission_participations p join public.missions m on m.id = p.mission_id
       where p.user_id = $1 and m.code = 'D02' order by p.period_start`,
      [u],
    );
    assert.deepEqual(d02.map((r) => r.status), ["expired", "available"]);
    assert.equal(await xpTotal(db, u), 100);
  });

  it("una misión archivada deja de abrirse pero su historial y XP siguen visibles para el licenciado", async () => {
    const u = await createLicensee(db, "archivada@test.com");
    await refresh(db, u);
    const d03 = await participation(db, u, "D03");
    await db.sql(
      `insert into public.xp_ledger (user_id, amount, transaction_type, mission_id, participation_id, description, idempotency_key)
       select $1, 30, 'mission_reward', mission_id, id, 'histórico', 'mission_reward:' || id from public.mission_participations where id = $2`,
      [u, d03.id],
    );
    await db.sql(`update public.mission_participations set status = 'completed', current_progress = 1, completed_at = now() where id = $1`, [d03.id]);
    await db.sql(`update public.missions set status = 'archived' where code = 'D03'`);

    const other = await createLicensee(db, "nueva-archivada@test.com");
    await refresh(db, other);
    assert.equal(await participation(db, other, "D03"), undefined);

    const seen = await db.as<{ code: string; status: string }>(
      u,
      `select m.code, m.status from public.mission_participations p join public.missions m on m.id = p.mission_id where m.code = 'D03'`,
    );
    assert.deepEqual(seen, [{ code: "D03", status: "archived" }]);
    assert.equal((await db.as(other, `select 1 from public.missions where code = 'D03'`)).length, 0);
    assert.equal(await xpTotal(db, u), 30);
    await db.sql(`update public.missions set status = 'active' where code = 'D03'`);
  });

  it("calcula los períodos en la zona horaria de la campaña (semana de lunes a domingo)", async () => {
    // 2026-10-19 02:00 UTC es todavía domingo 18 en Caracas (UTC-4).
    const [r] = await db.sql<{ period_start: Date; period_end: Date }>(
      `select period_start::text, period_end::text from public.mission_period('weekly', 'America/Caracas', '2026-10-19T02:00:00Z')`,
    );
    assert.deepEqual([String(r.period_start), String(r.period_end)], ["2026-10-12", "2026-10-18"]);
    const [d] = await db.sql<{ period_start: string }>(
      `select period_start::text from public.mission_period('daily', 'Asia/Tokyo', '2026-10-19T16:00:00Z')`,
    );
    assert.equal(d.period_start, "2026-10-20");
    const [m] = await db.sql<{ period_start: string; period_end: string }>(
      `select period_start::text, period_end::text from public.mission_period('monthly', 'America/Caracas', '2026-02-10T12:00:00Z')`,
    );
    assert.deepEqual([m.period_start, m.period_end], ["2026-02-01", "2026-02-28"]);
  });
});

describe("Misiones automáticas por ventas", () => {
  it("una venta pendiente no da XP; al verificarse completa D01 una sola vez", async () => {
    const u = await createLicensee(db, "ventas1@test.com");
    await refresh(db, u);
    const sale = await registerSale(db, u);
    await refresh(db, u);
    assert.equal((await participation(db, u, "D01")).status, "available");
    assert.equal(await xpTotal(db, u), 0);

    await db.as(admin, `select public.review_sale($1, true)`, [sale]);
    const d01 = await participation(db, u, "D01");
    assert.equal(d01.status, "completed");
    assert.equal(await xpTotal(db, u), 100);

    // Segunda venta del día y refrescos repetidos: no se paga de nuevo.
    await sellAndVerify(db, u, admin);
    await refresh(db, u);
    await refresh(db, u);
    await db.sql(`select public.recompute_participation($1)`, [d01.id]);
    const rewards = await db.sql(`select id from public.xp_ledger where participation_id = $1`, [d01.id]);
    assert.equal(rewards.length, 1);
    assert.equal(Number((await participation(db, u, "S01")).current_progress), 2);
  });

  it("ventas rechazadas o anuladas no cuentan", async () => {
    const u = await createLicensee(db, "ventas2@test.com");
    const rejected = await registerSale(db, u);
    await db.as(admin, `select public.review_sale($1, false, 'No verificable')`, [rejected]);
    const cancelled = await registerSale(db, u);
    await db.as(u, `select public.cancel_sale($1, 'Duplicada')`, [cancelled]);
    await refresh(db, u);
    assert.equal((await participation(db, u, "D01")).status, "available");
    assert.equal(await xpTotal(db, u), 0);
  });

  it("anular una venta ya premiada genera una alerta para corrección auditada", async () => {
    const u = await createLicensee(db, "ventas3@test.com");
    const sale = await sellAndVerify(db, u, admin);
    assert.equal((await participation(db, u, "D01")).status, "completed");
    await db.as(admin, `select public.cancel_sale($1, 'Cliente devolvió')`, [sale]);
    const flags = await db.sql<{ kind: string }>(`select kind from public.fraud_flags where user_id = $1`, [u]);
    assert.ok(flags.some((f) => f.kind === "reward_review_needed"));
    // El XP no se borra: se corrige con un ajuste auditado.
    assert.equal(await xpTotal(db, u), 100);
    const d01 = await participation(db, u, "D01");
    await db.as(admin, `select public.admin_adjust_xp($1, -100, 'Reversión por devolución', 'rev-1', $2)`, [u, d01.id]);
    assert.equal(await xpTotal(db, u), 0);
    const [tx] = await db.sql<{ transaction_type: string }>(
      `select transaction_type from public.xp_ledger where user_id = $1 and amount < 0`,
      [u],
    );
    assert.equal(tx.transaction_type, "reversal");
  });

  it("cuenta unidades por categoría (hoodies) y unidades totales", async () => {
    const u = await createLicensee(db, "hoodies@test.com");
    await sellAndVerify(db, u, admin, { items: [{ sku: HOODIE, quantity: 6 }, { sku: SHIRT, quantity: 4 }] });
    assert.equal(Number((await participation(db, u, "S06")).current_progress), 6);
    assert.equal(Number((await participation(db, u, "M01")).current_progress), 10);
    await sellAndVerify(db, u, admin, { items: [{ sku: HOODIE, quantity: 4 }] });
    const s06 = await participation(db, u, "S06");
    assert.equal(s06.status, "completed");
    const [row] = await db.sql<{ amount: number }>(`select amount from public.xp_ledger where participation_id = $1`, [s06.id]);
    assert.equal(row.amount, 700);
  });

  it("S07 cuenta compras de clientes recurrentes y M05 clientes distintos", async () => {
    const u = await createLicensee(db, "clientes@test.com");
    const old = new Date(Date.now() - 20 * 86400000);
    await sellAndVerify(db, u, admin, { customer: "Maria P", soldAt: old });
    await sellAndVerify(db, u, admin, { customer: "maria p" }); // misma clienta, normalizada
    await sellAndVerify(db, u, admin, { customer: "Jose" });
    await refresh(db, u);
    assert.equal(Number((await participation(db, u, "S07")).current_progress), 1);
    await sellAndVerify(db, u, admin, { customer: "Jose" });
    assert.equal((await participation(db, u, "S07")).status, "completed");
  });

  it("M09 no se activa sin datos comparables del mes anterior", async () => {
    const u = await createLicensee(db, "crecimiento@test.com");
    await sellAndVerify(db, u, admin);
    const m09 = await participation(db, u, "M09");
    assert.equal(m09.current_progress, null);
    assert.notEqual(m09.status, "completed");
  });

  it("D10 se completa con tres misiones diarias diferentes y no se cuenta a sí misma", async () => {
    const u = await createLicensee(db, "disciplina@test.com");
    await refresh(db, u);
    await sellAndVerify(db, u, admin); // D01
    for (const code of ["D02", "D03"]) {
      const p = await participation(db, u, code);
      const res = await submitEvidence(u, p.id, `https://instagram.com/reel/${code}-disciplina`);
      assert.ok(res.ok, res.error);
      await review(res.evidence_id!, true);
    }
    const d10 = await participation(db, u, "D10");
    assert.equal(d10.status, "completed");
    assert.equal(Number(d10.current_progress), 3);
    assert.equal(await xpTotal(db, u), 100 + 80 + 30 + 100);
  });
});

describe("Evidencias y revisión manual", () => {
  it("flujo completo: enviar, rechazar con motivo, reenviar y aprobar", async () => {
    const u = await createLicensee(db, "contenido@test.com");
    await refresh(db, u);
    const p = await participation(db, u, "D02");
    const first = await submitEvidence(u, p.id, "https://www.instagram.com/reel/ABC123/?igsh=xyz");
    assert.ok(first.ok);
    assert.equal((await participation(db, u, "D02")).status, "pending_review");
    assert.equal(await xpTotal(db, u), 0);

    await assert.rejects(review(first.evidence_id!, false, ""), /motivo/);
    assert.equal(await review(first.evidence_id!, false, "El producto no se ve"), "rejected");
    const rejected = await participation(db, u, "D02");
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejection_reason, "El producto no se ve");
    // El licenciado ve el motivo.
    const [mine] = await db.as<{ rejection_reason: string }>(
      u,
      `select rejection_reason from public.mission_participations where id = $1`,
      [p.id],
    );
    assert.equal(mine.rejection_reason, "El producto no se ve");

    const second = await submitEvidence(u, p.id, "https://instagram.com/reel/DEF456");
    assert.ok(second.ok);
    assert.equal(await review(second.evidence_id!, true), "completed");
    assert.equal(await xpTotal(db, u), 80);
    await assert.rejects(review(second.evidence_id!, true), /ya fue revisada/);
    assert.equal(await xpTotal(db, u), 80);
  });

  it("la misma evidencia no puede usarse dos veces para la misma misión (ni por otro licenciado)", async () => {
    const a = await createLicensee(db, "dup-a@test.com");
    const b = await createLicensee(db, "dup-b@test.com");
    await refresh(db, a);
    await refresh(db, b);
    const pa = await participation(db, a, "S02");
    const ok = await submitEvidence(a, pa.id, "https://instagram.com/reel/UNICO");
    assert.ok(ok.ok);
    const again = await submitEvidence(a, pa.id, "http://www.Instagram.com/reel/UNICO/?utm_source=x#top");
    assert.equal(again.ok, false);
    assert.match(again.error!, /ya se utilizó/);
    const pb = await participation(db, b, "S02");
    const copy = await submitEvidence(b, pb.id, "https://instagram.com/reel/UNICO");
    assert.equal(copy.ok, false);
    const flags = await db.sql(`select id from public.fraud_flags where kind = 'duplicate_evidence'`);
    assert.equal(flags.length, 2);
    // El mismo Reel sí sirve para otra misión distinta (D02 diaria).
    const d02 = await participation(db, a, "D02");
    assert.ok((await submitEvidence(a, d02.id, "https://instagram.com/reel/UNICO")).ok);
  });

  it("las misiones con varias evidencias avanzan una a una", async () => {
    const u = await createLicensee(db, "reels@test.com");
    await refresh(db, u);
    const p = await participation(db, u, "S02");
    for (let i = 1; i <= 3; i++) {
      const r = await submitEvidence(u, p.id, `https://instagram.com/reel/semana-${i}`);
      assert.ok(r.ok, r.error);
      const status = await review(r.evidence_id!, true);
      assert.equal(status, i < 3 ? "in_progress" : "completed");
    }
    const extra = await submitEvidence(u, p.id, "https://instagram.com/reel/semana-4");
    assert.equal(extra.ok, false);
    assert.equal(await xpTotal(db, u), 350);
  });

  it("no admite evidencias en misiones automáticas, enlaces inválidos ni participaciones ajenas", async () => {
    const u = await createLicensee(db, "invalid@test.com");
    const other = await createLicensee(db, "other@test.com");
    await refresh(db, u);
    await refresh(db, other);
    const d01 = await participation(db, u, "D01");
    assert.equal((await submitEvidence(u, d01.id, "https://x.com/a")).ok, false);
    const d02 = await participation(db, u, "D02");
    assert.equal((await submitEvidence(u, d02.id, "javascript:alert(1)")).ok, false);
    await assert.rejects(submitEvidence(other, d02.id, "https://instagram.com/reel/ajeno"), /no encontrada/);
  });

  it("solo un administrador revisa, y no sus propias evidencias", async () => {
    const u = await createLicensee(db, "selfreview@test.com");
    await refresh(db, u);
    const p = await participation(db, u, "D06");
    const r = await submitEvidence(u, p.id, "https://instagram.com/p/selfreview");
    await assert.rejects(db.as(u, `select public.review_mission_evidence($1, true)`, [r.evidence_id]), /administrador/);
    await db.sql(`update public.profiles set role = 'admin' where id = $1`, [u]);
    await assert.rejects(db.as(u, `select public.review_mission_evidence($1, true)`, [r.evidence_id]), /propias/);
    await db.sql(`update public.profiles set role = 'licensee' where id = $1`, [u]);
  });
});

describe("Configuración por el administrador", () => {
  it("el admin crea, edita y duplica misiones; queda auditado", async () => {
    const [m] = await db.as<{ id: string }>(
      admin,
      `insert into public.missions (code, title, description, category, frequency, target_value, target_unit, metric, xp_reward, validation_method, evidence_required, status)
       values ('ESP01', 'Misión especial', 'Prueba', 'Contenido', 'weekly', 2, 'publicaciones', 'approved_evidence_count', 150, 'manual', true, 'active')
       returning id`,
    );
    await db.as(admin, `update public.missions set xp_reward = 175 where id = $1`, [m.id]);
    const [dup] = await db.as<{ id: string }>(admin, `select public.duplicate_mission($1, 'ESP02') as id`, [m.id]);
    const [copy] = await db.sql<{ status: string; xp_reward: number }>(`select status, xp_reward from public.missions where id = $1`, [dup.id]);
    assert.deepEqual(copy, { status: "draft", xp_reward: 175 });
    const audit = await db.sql<{ action: string }>(
      `select action from public.audit_log where entity_type = 'mission' and entity_id in ($1, $2) order by id`,
      [m.id, dup.id],
    );
    assert.deepEqual(audit.map((a) => a.action), ["mission.created", "mission.updated", "mission.created"]);
  });

  it("rechaza configuraciones incoherentes", async () => {
    const base = `insert into public.missions (code, title, category, frequency, target_value, target_unit, metric, xp_reward, validation_method, evidence_required, timezone)`;
    await assert.rejects(db.as(admin, `${base} values ('BAD1', 'Mala', 'Ventas', 'daily', 0, 'v', 'verified_sales_count', 10, 'auto', false, 'America/Caracas')`), /check/);
    await assert.rejects(db.as(admin, `${base} values ('BAD2', 'Mala', 'Ventas', 'daily', 1, 'v', 'approved_evidence_count', 10, 'auto', false, 'America/Caracas')`), /check/);
    await assert.rejects(db.as(admin, `${base} values ('BAD3', 'Mala', 'Ventas', 'daily', 1, 'v', 'verified_sales_count', 10, 'auto', false, 'Marte/Olympus')`), /Zona horaria/);
  });

  it("un licenciado no puede crear ni editar misiones", async () => {
    const u = await createLicensee(db, "noedit@test.com");
    await assert.rejects(
      db.as(u, `insert into public.missions (code, title, category, frequency, target_value, target_unit, metric, xp_reward, validation_method) values ('HACK', 'Hack', 'Ventas', 'daily', 1, 'v', 'verified_sales_count', 99999, 'auto')`),
      /row-level security/,
    );
    const updated = await db.as(u, `update public.missions set xp_reward = 99999 where code = 'D01' returning id`);
    assert.equal(updated.length, 0);
  });

  it("cambiar los XP de una misión no altera participaciones ya abiertas ni premios concedidos", async () => {
    const u = await createLicensee(db, "snapshot@test.com");
    await refresh(db, u);
    await db.as(admin, `update public.missions set xp_reward = 999 where code = 'S01'`);
    for (let i = 0; i < 5; i++) await sellAndVerify(db, u, admin);
    const s01 = await participation(db, u, "S01");
    assert.equal(s01.status, "completed");
    const [r] = await db.sql<{ amount: number }>(`select amount from public.xp_ledger where participation_id = $1`, [s01.id]);
    assert.equal(r.amount, 500);
    await db.as(admin, `update public.missions set xp_reward = 500 where code = 'S01'`);
  });
});
