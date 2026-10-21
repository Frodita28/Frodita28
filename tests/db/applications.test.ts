import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createLicensee, createUser, freshDb, type Db } from "./helpers";

let db: Db;
let admin: string;
let admin2: string;
let plan1: string;
let plan4: string;

const form = (over: Record<string, unknown> = {}) => ({
  full_name: "Carla Gómez",
  phone: "+58 412 555 1234",
  country: "Venezuela",
  city: "Valencia",
  business_name: "Carla Urbana",
  experience: "Vendo ropa por Instagram desde hace dos años.",
  sales_channels: ["instagram", "whatsapp"],
  social_links: "https://instagram.com/carla",
  motivation: "Me identifico con la marca.",
  acknowledged: true,
  ...over,
});

async function submit(userId: string, over: Record<string, unknown> = {}) {
  const [r] = await db.as<{ id: string }>(userId, `select public.submit_license_application($1::jsonb) as id`, [JSON.stringify(form(over))]);
  return r.id;
}

const review = (adminId: string, appId: string, action: string, message: string | null = null, planId: string | null = null) =>
  db.as(adminId, `select public.review_license_application($1, $2, $3, $4)`, [appId, action, message, planId]);

const activate = (adminId: string, appId: string, contract: string | null = "CT-2026-001", startsAt: string | null = "2026-10-21") =>
  db.as<{ id: string }>(adminId, `select public.activate_application_license($1, 'Valencia', $2::date, null, $3) as id`, [appId, startsAt, contract]);

async function status(appId: string) {
  const [r] = await db.sql<{ status: string; assigned_plan_id: string | null; admin_message: string | null; license_id: string | null }>(
    `select status, assigned_plan_id, admin_message, license_id from public.license_applications where id = $1`,
    [appId],
  );
  return r;
}

before(async () => {
  db = await freshDb();
  admin = await createUser(db, "admin@gallonegro.test", "admin");
  admin2 = await createUser(db, "admin2@gallonegro.test", "admin");
  [{ id: plan1 }] = await db.sql<{ id: string }>(`select id from public.license_plans where code = 'PLAN_1'`);
  [{ id: plan4 }] = await db.sql<{ id: string }>(`select id from public.license_plans where code = 'PLAN_4'`);
});
after(() => db.close());

describe("Envío de solicitudes", () => {
  it("un solicitante envía su solicitud y queda pendiente con historial", async () => {
    const carla = await createUser(db, "carla@test.com");
    const id = await submit(carla, { preferred_plan_id: plan1, sales_channels: ["instagram", "instagram", "tiktok"] });
    const [app] = await db.as<{ status: string; email: string; sales_channels: string[]; preferred_plan_id: string }>(
      carla,
      `select status, email, sales_channels, preferred_plan_id from public.license_applications where id = $1`,
      [id],
    );
    assert.equal(app.status, "submitted");
    assert.equal(app.email, "carla@test.com");
    assert.deepEqual([...app.sales_channels].sort(), ["instagram", "tiktok"]);
    assert.equal(app.preferred_plan_id, plan1);
    const events = await db.as<{ event: string }>(carla, `select event from public.application_events where application_id = $1`, [id]);
    assert.deepEqual(events.map((e) => e.event), ["submitted"]);
    const audit = await db.sql(`select 1 from public.audit_log where action = 'application.submitted' and entity_id = $1`, [id]);
    assert.equal(audit.length, 1);
  });

  it("valida los datos en el servidor", async () => {
    const u = await createUser(db, "invalida@test.com");
    await assert.rejects(submit(u, { acknowledged: false }), /no es una licencia/);
    await assert.rejects(submit(u, { phone: "abc" }), /teléfono/);
    await assert.rejects(submit(u, { city: "" }), /ciudad/);
    await assert.rejects(submit(u, { experience: "poco" }), /experiencia/);
    await assert.rejects(submit(u, { sales_channels: [] }), /canal/);
    await assert.rejects(submit(u, { sales_channels: ["piramide"] }), /canal/);
    await db.sql(`update public.license_plans set status = 'inactive' where id = $1`, [plan4]);
    await assert.rejects(submit(u, { preferred_plan_id: plan4 }), /no está disponible/);
    await db.sql(`update public.license_plans set status = 'pending_confirmation' where id = $1`, [plan4]);
  });

  it("solo una solicitud abierta por persona", async () => {
    const u = await createUser(db, "doble@test.com");
    await submit(u);
    await assert.rejects(submit(u), /en curso/);
  });

  it("licenciados, administradores y visitantes no pueden enviar solicitudes", async () => {
    const lic = await createLicensee(db, "yalicenciado@test.com");
    await assert.rejects(submit(lic), /licenciado o administrador/);
    await assert.rejects(submit(admin), /licenciado o administrador/);
    await assert.rejects(db.anon(`select public.submit_license_application('{}'::jsonb)`), /permission denied/);
  });

  it("nadie escribe directamente en las tablas de solicitudes", async () => {
    const u = await createUser(db, "directo@test.com");
    const id = await submit(u);
    await assert.rejects(
      db.as(u, `insert into public.license_applications (user_id, full_name, phone, country, city, experience, sales_channels, acknowledged_at)
                values ($1, 'X', '123456', 'VE', 'CCS', 'experiencia larga', '{instagram}', now())`, [u]),
      /permission denied/,
    );
    await assert.rejects(db.as(u, `update public.license_applications set status = 'approved' where id = $1`, [id]), /permission denied/);
    await assert.rejects(db.as(admin, `update public.license_applications set status = 'approved' where id = $1`, [id]), /permission denied/);
    await assert.rejects(db.as(u, `insert into public.application_events (application_id, event) values ($1, 'approved')`, [id]), /permission denied/);
    await assert.rejects(db.sql(`delete from public.application_events`), /solo inserción/);
    await assert.rejects(db.as(u, `select public.log_application_event($1, 'approved', 'submitted', 'approved')`, [id]), /permission denied/);
  });
});

describe("Correcciones y retiro por el solicitante", () => {
  it("corrige cuando se le pide información y la solicitud vuelve a pendiente", async () => {
    const u = await createUser(db, "corrige@test.com");
    const id = await submit(u);
    await review(admin, id, "start_review");
    await assert.rejects(
      db.as(u, `select public.update_license_application($1, $2::jsonb)`, [id, JSON.stringify(form())]),
      /ya no se puede modificar/,
    );
    await assert.rejects(review(admin, id, "request_info"), /qué información/);
    await review(admin, id, "request_info", "Añade el enlace a tu Instagram de ventas");
    const asked = await status(id);
    assert.equal(asked.status, "needs_info");
    assert.equal(asked.admin_message, "Añade el enlace a tu Instagram de ventas");

    await db.as(u, `select public.update_license_application($1, $2::jsonb)`, [id, JSON.stringify(form({ social_links: "https://instagram.com/ventas" }))]);
    assert.equal((await status(id)).status, "submitted");
    const events = await db.as<{ event: string }>(u, `select event from public.application_events where application_id = $1 order by id`, [id]);
    assert.deepEqual(events.map((e) => e.event), ["submitted", "review_started", "info_requested", "resubmitted"]);
  });

  it("puede retirarla y volver a solicitar", async () => {
    const u = await createUser(db, "retira@test.com");
    const id = await submit(u);
    await db.as(u, `select public.withdraw_license_application($1, 'Más adelante')`, [id]);
    assert.equal((await status(id)).status, "withdrawn");
    await assert.rejects(db.as(u, `select public.withdraw_license_application($1)`, [id]), /ya no se puede retirar/);
    await submit(u);
  });

  it("no puede tocar solicitudes ajenas", async () => {
    const a = await createUser(db, "duena@test.com");
    const b = await createUser(db, "intrusa@test.com");
    const id = await submit(a);
    await assert.rejects(db.as(b, `select public.update_license_application($1, $2::jsonb)`, [id, JSON.stringify(form())]), /no encontrada/);
    await assert.rejects(db.as(b, `select public.withdraw_license_application($1)`, [id]), /no encontrada/);
  });
});

describe("Revisión y activación por el administrador", () => {
  it("aprueba con plan asignado y activa la licencia como acción separada y auditada", async () => {
    const u = await createUser(db, "aprobada@test.com");
    const id = await submit(u);
    await assert.rejects(review(admin, id, "approve"), /Asigna un plan/);
    await review(admin, id, "approve", "Bienvenida. Te contactaremos para el contrato.", plan1);
    const approved = await status(id);
    assert.equal(approved.status, "approved");
    assert.equal(approved.assigned_plan_id, plan1);

    // Aprobar no crea licencia ni cambia el rol.
    const [p1] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [u]);
    assert.equal(p1.role, "applicant");
    assert.equal((await db.sql(`select 1 from public.licenses where user_id = $1`, [u])).length, 0);

    await assert.rejects(activate(admin, id, ""), /contrato/);
    await assert.rejects(activate(admin, id, "CT-1", null), /inicio/);
    const [{ id: licenseId }] = await activate(admin, id);
    const [lic] = await db.sql<{ status: string; plan_id: string; created_by: string; contract_ref: string }>(
      `select status, plan_id, created_by, contract_ref from public.licenses where id = $1`,
      [licenseId],
    );
    assert.deepEqual(lic, { status: "active", plan_id: plan1, created_by: admin, contract_ref: "CT-2026-001" });
    const [p2] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [u]);
    assert.equal(p2.role, "licensee");
    assert.equal((await status(id)).license_id, licenseId);

    await assert.rejects(activate(admin, id), /ya tiene una licencia/);
    const actions = await db.sql<{ action: string }>(
      `select action from public.audit_log where (entity_id = $1 or entity_id = $2) order by id`,
      [id, licenseId],
    );
    assert.deepEqual(
      actions.map((a) => a.action),
      ["application.submitted", "application.approved", "license.created", "application.license_activated"],
    );
    await assert.rejects(db.as(u, `select public.withdraw_license_application($1)`, [id]), /ya no se puede retirar/);
  });

  it("rechaza con motivo visible y el solicitante puede volver a intentarlo", async () => {
    const u = await createUser(db, "rechazada@test.com");
    const id = await submit(u);
    await assert.rejects(review(admin, id, "reject"), /motivo/);
    await review(admin, id, "reject", "Por ahora no hay cupos en tu ciudad");
    assert.equal((await status(id)).status, "rejected");
    await assert.rejects(review(admin, id, "approve", null, plan1), /no se puede aprobar/);
    await assert.rejects(activate(admin, id), /aprobada/);
    await submit(u);
  });

  it("las notas internas no las ve el solicitante", async () => {
    const u = await createUser(db, "notas@test.com");
    const id = await submit(u);
    await review(admin, id, "note", "Verificar referencias comerciales");
    const mine = await db.as<{ event: string }>(u, `select event from public.application_events where application_id = $1`, [id]);
    assert.deepEqual(mine.map((e) => e.event), ["submitted"]);
    const all = await db.as<{ event: string }>(admin, `select event from public.application_events where application_id = $1`, [id]);
    assert.deepEqual(all.map((e) => e.event), ["submitted", "note"]);
    assert.equal((await status(id)).status, "submitted");
  });

  it("solo los administradores revisan y activan", async () => {
    const u = await createUser(db, "autoaprueba@test.com");
    const id = await submit(u);
    await assert.rejects(review(u, id, "approve", null, plan1), /administrador/);
    const lic = await createLicensee(db, "licrevisa@test.com");
    await assert.rejects(review(lic, id, "start_review"), /administrador/);
    await review(admin, id, "approve", null, plan1);
    await assert.rejects(activate(u, id), /administrador/);
    await assert.rejects(db.as(u, `insert into public.licenses (user_id, plan_id, status) values ($1, $2, 'active')`, [u, plan1]), /row-level security/);
    await assert.rejects(review(admin2, id, "teleport"), /no válida/);
  });

  it("no se puede revisar ni activar la propia solicitud aunque se llegue a ser admin", async () => {
    const u = await createUser(db, "futuraadmin@test.com");
    const id = await submit(u);
    await db.sql(`update public.profiles set role = 'admin' where id = $1`, [u]);
    await assert.rejects(review(u, id, "approve", null, plan1), /propia/);
    await review(admin, id, "approve", null, plan1);
    await assert.rejects(activate(u, id), /propia/);
  });
});

describe("Aislamiento y acceso público", () => {
  it("cada solicitante ve solo su solicitud; el admin ve todas; el visitante ninguna", async () => {
    const a = await createUser(db, "aisla-a@test.com");
    const b = await createUser(db, "aisla-b@test.com");
    await submit(a);
    await submit(b);
    const rows = await db.as<{ user_id: string }>(b, `select user_id from public.license_applications`);
    assert.deepEqual(rows.map((r) => r.user_id), [b]);
    const events = await db.as<{ application_id: string }>(b, `select e.application_id from public.application_events e`);
    const mineIds = (await db.sql<{ id: string }>(`select id from public.license_applications where user_id = $1`, [b])).map((r) => r.id);
    assert.ok(events.every((e) => mineIds.includes(e.application_id)));
    const all = await db.as(admin, `select 1 from public.license_applications`);
    assert.ok(all.length > 2);
    await assert.rejects(db.anon(`select id from public.license_applications`), /permission denied/);
    await assert.rejects(db.anon(`select id from public.application_events`), /permission denied/);
  });

  it("el público ve beneficios confirmados o según contrato, nunca los pendientes", async () => {
    await db.as(admin, `insert into public.plan_benefits (plan_id, description, status) values
      ($1, 'Acceso a material promocional', 'confirmed'),
      ($1, 'Participación en eventos deportivos', 'pending_approval'),
      ($1, 'Colaboraciones con artistas', 'contract_only')`, [plan1]);
    const pub = await db.anon<{ description: string }>(`select description from public.plan_benefits order by description`);
    assert.deepEqual(pub.map((b) => b.description), ["Acceso a material promocional", "Colaboraciones con artistas"]);
    const all = await db.as(admin, `select 1 from public.plan_benefits`);
    assert.equal(all.length, 3);
    await assert.rejects(db.anon(`insert into public.plan_benefits (plan_id, description) values ($1, 'hack')`, [plan1]), /permission denied/);
    const lic = await createLicensee(db, "beneficios@test.com");
    const ins = db.as(lic, `insert into public.plan_benefits (plan_id, description) values ($1, 'hack')`, [plan1]);
    await assert.rejects(ins, /row-level security/);
  });

  it("los planes se editan sin código, quedan auditados y no se publican sin precio", async () => {
    await assert.rejects(
      db.as(admin, `update public.license_plans set status = 'active' where id = $1`, [plan1]),
      /license_plans_active_has_price/,
    );
    await db.as(admin, `update public.license_plans set name = 'Plan Inicial', price = 100, currency = 'USD', status = 'active' where id = $1`, [plan4]);
    const [audit] = await db.sql<{ details: { name: string; previous: { name: string } } }>(
      `select details from public.audit_log where action = 'plan.updated' and entity_id = $1 order by id desc limit 1`,
      [plan4],
    );
    assert.equal(audit.details.name, "Plan Inicial");
    assert.equal(audit.details.previous.name, "Plan 4");
    const lic = await createLicensee(db, "editaplan@test.com");
    const changed = await db.as(lic, `update public.license_plans set price = 1 where id = $1 returning id`, [plan4]);
    assert.equal(changed.length, 0);
  });
});
