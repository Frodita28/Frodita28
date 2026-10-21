// Prueba de punta a punta de la página pública y las solicitudes de licencia.
// Requiere Supabase local (npx supabase start) y la app en :3000, igual que flow.mjs.
// Uso: SUPABASE_SERVICE_ROLE_KEY=... node tests/e2e/applications.mjs [carpeta-capturas]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SHOTS = process.argv[2] ?? "/tmp/gn-shots";
mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const ADMIN = { email: `admin.sol.${stamp}@gallonegro.test`, password: "AdminSeguro123", name: "Admin Gallo Negro" };
const APPLICANT = { email: `luis.${stamp}@test.com`, password: "SolicitanteSeguro1", name: "Luis Rojas" };

const psql = (sql) => execFileSync("psql", [DB_URL, "-tAc", sql], { encoding: "utf8" }).trim();
const log = (m) => console.log(`✓ ${m}`);

/** Crea un usuario con el correo ya confirmado (API de administración de Supabase Auth). */
async function createUser({ email, password, name }) {
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name } }),
  });
  const user = await res.json();
  assert.ok(user.id, JSON.stringify(user));
  return user.id;
}

async function login(page, { email, password }, next = "/panel") {
  await page.goto(`${APP}/login?next=${encodeURIComponent(next)}`);
  await page.fill("#username", email);
  await page.fill("#password", password);
  await page.click("button:has-text('Entrar')");
  await page.waitForURL((u) => u.pathname.startsWith(next));
}

/** Pulsa un botón de formulario y espera la redirección con el resultado (?ok= / ?error=). */
async function submit(scope, page, button, kind = "ok") {
  // Si la URL ya trae un resultado igual, el siguiente no la cambiaría: se marca para distinguirlo.
  await page.evaluate(() => history.replaceState(null, "", location.pathname + "?_=1"));
  await scope.locator(`button:has-text('${button}')`).first().click();
  await page.waitForURL((u) => !u.searchParams.has("_") && u.searchParams.has(kind));
}

const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const flash = async (page) => (await page.locator("[role=status], [role=alert]").first().textContent())?.trim();

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const visitor = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const vp = await visitor.newPage();
const ap = await adminCtx.newPage();

try {
  const adminId = await createUser(ADMIN);
  psql(`update public.profiles set role = 'admin' where id = '${adminId}'`);
  const applicantId = await createUser(APPLICANT);
  log("usuarios creados");

  // 1. El visitante ve la página pública con los planes pendientes, sin precios inventados.
  await vp.goto(APP);
  const plans = vp.locator("article[data-plan]");
  assert.equal(await plans.count(), 4);
  for (let i = 0; i < 4; i++) assert.match(await plans.nth(i).textContent(), /Precio pendiente de confirmación/);
  assert.doesNotMatch(await vp.textContent("main"), /\$\s?\d|USD\s?\d/);
  await vp.locator("summary", { hasText: "¿La licencia garantiza ganancias?" }).click();
  assert.match(await vp.textContent("#preguntas"), /no es una inversión con rentabilidad garantizada/i);
  await shot(vp, "08-publico-inicio");
  log("página pública: 4 planes pendientes y preguntas frecuentes");

  // 2. Sin registro público: "Solicitar licencia" lleva al contacto; con cuenta asignada, al formulario.
  await vp.click("text=Solicitar licencia");
  await vp.waitForURL(/#contacto$/);
  await vp.goto(`${APP}/panel/solicitud`);
  await vp.waitForURL(/\/login\?next=%2Fpanel%2Fsolicitud/);
  await login(vp, APPLICANT, "/panel/solicitud");
  log("solicitar licencia lleva al contacto; con cuenta asignada se llega al formulario");

  // 3. El solicitante envía su solicitud.
  await vp.fill("#phone", "+58 414 000 1122");
  await vp.fill("#city", "Maracay");
  await vp.fill("#experience", "Vendo ropa deportiva por WhatsApp e Instagram desde 2023.");
  await vp.check("input[name=sales_channels][value=instagram]");
  await vp.check("input[name=sales_channels][value=whatsapp]");
  await vp.selectOption("#preferred_plan_id", { label: "Plan 2 (condiciones pendientes)" });
  await vp.click("button:has-text('Enviar solicitud')");
  assert.equal(await vp.locator("input[name=acknowledged]:invalid").count(), 1, "sin aceptar las condiciones no se envía");
  await vp.check("input[name=acknowledged]");
  await submit(vp, vp, "Enviar solicitud");
  assert.match(await vp.textContent("main"), /Pendiente/);
  await shot(vp, "09-solicitante-pendiente");
  log("solicitud enviada (bloqueada hasta aceptar que no es una licencia)");

  // 4. Un no administrador no entra a la revisión.
  await vp.goto(`${APP}/admin/solicitudes`);
  await vp.waitForURL(/\/panel\?error=/);
  log("el solicitante no accede a /admin/solicitudes");

  // 5. El admin pide correcciones.
  await login(ap, ADMIN, "/admin");
  await ap.goto(`${APP}/admin/solicitudes`);
  await ap.click(`text=${APPLICANT.name}`);
  await ap.waitForURL(/\/admin\/solicitudes\/[0-9a-f-]{36}/);
  const detailUrl = ap.url();
  await submit(ap, ap, "Marcar en revisión");
  await ap.fill("#info_message", "Añade el enlace de tu Instagram de ventas.");
  await submit(ap, ap, "Pedir correcciones");
  await ap.fill("textarea[name=message][aria-label='Nota interna']", "Conocido de la tienda de Maracay");
  await submit(ap, ap, "Guardar nota");
  log("admin: en revisión, pide correcciones y deja nota interna");

  // 6. El solicitante ve el mensaje (no la nota interna) y corrige.
  await vp.goto(`${APP}/panel/solicitud`);
  let text = await vp.textContent("main");
  assert.match(text, /Requiere información/);
  assert.match(text, /Añade el enlace de tu Instagram de ventas/);
  assert.doesNotMatch(text, /Conocido de la tienda/);
  await vp.fill("#social_links", "instagram.com/luis_ventas");
  await submit(vp, vp, "Enviar correcciones");
  assert.match(await vp.textContent("main"), /Correcciones enviadas/);
  log("solicitante corrige; la nota interna no se le muestra");

  // 7. El admin aprueba con plan y luego activa la licencia.
  await ap.goto(detailUrl);
  await ap.selectOption("#plan_id", { label: "Plan 2 (provisional)" });
  await submit(ap, ap, "Aprobar solicitud");
  assert.equal(psql(`select role from public.profiles where id = '${applicantId}'`), "applicant", "aprobar no activa la licencia");
  await ap.fill("#contract_ref", `CT-${stamp}`);
  await ap.click("button:has-text('Activar licencia')");
  assert.ok(await ap.locator("input[name=formalized]:invalid").count(), "la confirmación es obligatoria");
  await ap.check("input[name=formalized]");
  await shot(ap, "10-admin-solicitud");
  await submit(ap, ap, "Activar licencia");
  assert.match(await flash(ap), /Licencia activada/);
  assert.equal(psql(`select role from public.profiles where id = '${applicantId}'`), "licensee");
  assert.ok(Number(psql(`select count(*) from public.audit_log where action = 'application.license_activated' and actor_id = '${adminId}'`)) === 1, "activación auditada");
  log("aprobación con plan y activación auditada; el solicitante pasa a licenciado");

  await vp.goto(`${APP}/panel/solicitud`);
  assert.match(await vp.textContent("main"), /Tu licencia está activa/);
  await shot(vp, "11-solicitante-licencia-activa");
  await vp.goto(`${APP}/panel`);
  assert.match(await vp.textContent("main"), /Plan 2/);
  log("el nuevo licenciado ve su licencia");

  // 8. El admin configura un plan sin tocar código: el beneficio pendiente no se publica.
  await ap.goto(`${APP}/admin/planes`);
  const plan1 = ap.locator("section[id^=plan-]").first();
  await plan1.locator("input[name=description][placeholder='Nuevo beneficio']").fill(`Material promocional ${stamp}`);
  await plan1.locator("select[name=status][aria-label=Clasificación]").last().selectOption("confirmed");
  await submit(plan1, ap, "Añadir");
  await ap.locator("section[id^=plan-]").first().locator("input[name=description][placeholder='Nuevo beneficio']").fill(`Evento por confirmar ${stamp}`);
  await submit(ap.locator("section[id^=plan-]").first(), ap, "Añadir");
  const p1 = ap.locator("section[id^=plan-]").first();
  await p1.locator("select[name=status]").first().selectOption("active");
  await submit(p1, ap, "Guardar plan", "error");
  assert.match(await flash(ap), /precio y moneda/);
  await shot(ap, "12-admin-planes");
  log("admin: beneficios clasificados y no se publica un plan sin precio");

  await vp.goto(APP);
  const publicText = await vp.locator("article[data-plan=PLAN_1]").textContent();
  assert.match(publicText, new RegExp(`Material promocional ${stamp}`));
  assert.doesNotMatch(publicText, new RegExp(`Evento por confirmar ${stamp}`));
  log("la página pública muestra solo beneficios confirmados");

  console.log("\nTodo correcto. Capturas en", SHOTS);
} catch (err) {
  await shot(vp, "error-visitante").catch(() => {});
  await shot(ap, "error-admin").catch(() => {});
  throw err;
} finally {
  await browser.close();
}
