// Prueba de punta a punta contra Supabase local (npx supabase start) y la app en :3000.
// Uso: node tests/e2e/flow.mjs [carpeta-capturas]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SHOTS = process.argv[2] ?? "/tmp/gn-shots";
mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const ADMIN = { email: `admin.${stamp}@gallonegro.test`, password: "AdminSeguro123" };
const LIC = { email: `ana.${stamp}@test.com`, password: "LicenciadaSegura1", name: "Ana Pérez" };

const psql = (sql) => execFileSync("psql", [DB_URL, "-tAc", sql], { encoding: "utf8" }).trim();
const log = (m) => console.log(`✓ ${m}`);

async function createAdmin() {
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password, email_confirm: true, user_metadata: { full_name: "Admin Gallo Negro" } }),
  });
  const user = await res.json();
  assert.ok(user.id, JSON.stringify(user));
  psql(`update public.profiles set role = 'admin' where id = '${user.id}'`);
}

async function confirmationLink(email) {
  for (let i = 0; i < 20; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const m = /(http[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+)/.exec(msg.Text ?? msg.HTML);
      if (m) return m[1].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("No llegó el correo de verificación");
}

async function login(page, { email, password }, next = "/panel") {
  await page.goto(`${APP}/login?next=${encodeURIComponent(next)}`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button:has-text('Entrar')");
  await page.waitForURL((u) => u.pathname.startsWith(next));
}

async function selectByText(scope, selector, re) {
  const value = await scope.locator(selector).first().evaluate(
    (el, src) => [...el.options].find((o) => new RegExp(src).test(o.textContent))?.value,
    re.source,
  );
  assert.ok(value, `opción ${re} no encontrada en ${selector}`);
  await scope.locator(selector).first().selectOption(value);
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const admin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const lic = await browser.newContext(mobile);
const ap = await admin.newPage();
const lp = await lic.newPage();

try {
  await createAdmin();
  log("administrador creado");

  // 1. Registro y verificación de correo del licenciado.
  await lp.goto(`${APP}/registro`);
  await lp.fill("#full_name", LIC.name);
  await lp.fill("#email", LIC.email);
  await lp.fill("#password", LIC.password);
  await lp.click("button:has-text('Crear cuenta')");
  await lp.waitForURL(/\/login\?ok=/);
  await login(lp, LIC).then(
    () => assert.fail("no debería poder entrar sin verificar"),
    () => {},
  );
  assert.match(await lp.textContent("[role=alert]"), /Confirma tu correo/);
  await lp.goto(await confirmationLink(LIC.email));
  await lp.waitForURL(/\/panel/);
  log("registro + verificación de correo");
  await lp.goto(`${APP}/panel/misiones`);
  assert.match(await lp.textContent("main"), /Necesitas una licencia activa/);
  log("sin licencia no hay misiones");

  // 2. El licenciado no puede entrar al panel administrativo.
  await lp.goto(`${APP}/admin`);
  await lp.waitForURL(/\/panel\?error=/);
  log("un no-admin es expulsado de /admin");

  // 3. El admin activa la licencia.
  await login(ap, ADMIN, "/admin");
  await ap.goto(`${APP}/admin/licencias`);
  await selectByText(ap, "#user_id", new RegExp(`${LIC.name}`));
  await ap.selectOption("#plan_id", { label: "Plan 1 (provisional)" });
  await ap.fill("#territory", "Caracas");
  await ap.click("button:has-text('Registrar')");
  await ap.waitForURL(/ok=/);
  log("licencia activada");

  // 4. Misiones del licenciado.
  await lp.goto(`${APP}/panel/misiones`);
  const cards = await lp.locator("article").count();
  assert.equal(cards, 8, "8 misiones diarias activas");
  await shot(lp, "01-licenciado-misiones-diarias");

  // Evidencia por enlace (D02) y por captura (D03).
  const d02 = lp.locator("article", { hasText: "El primer Reel" });
  await d02.locator("input[name=url]").fill(`https://www.instagram.com/reel/E2E${stamp}/?igsh=abc`);
  await d02.locator("button:has-text('Enviar evidencia')").click();
  await lp.waitForURL(/ok=/);
  const d03 = lp.locator("article", { hasText: "Presencia en redes" });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  await d03.locator("input[name=file]").setInputFiles({ name: "historia.png", mimeType: "image/png", buffer: png });
  await d03.locator("button:has-text('Enviar evidencia')").click();
  await lp.waitForURL(/ok=/);
  log("evidencias enviadas (enlace y captura)");

  // Reutilizar el mismo Reel en D02 queda bloqueado (el formulario ya no se ofrece porque el objetivo está cubierto).
  assert.equal(await lp.locator("article", { hasText: "El primer Reel" }).locator("form").count(), 0);

  // 5. Registrar una venta.
  await lp.goto(`${APP}/panel/ventas`);
  await lp.fill("#reference", `IG-${stamp}`);
  await selectByText(lp, "select[name=product_0]", /Hoodie Obsidiana/);
  await lp.fill("input[name=quantity_0]", "2");
  await lp.fill("input[name=price_0]", "35");
  await lp.fill("#customer_ref", "@cliente_uno");
  await lp.click("button:has-text('Registrar venta')");
  await lp.waitForURL(/ok=/);
  // Referencia duplicada
  await lp.fill("#reference", `ig ${stamp}`.replace(" ", "-"));
  await selectByText(lp, "select[name=product_0]", /Hoodie Obsidiana/);
  await lp.fill("input[name=price_0]", "35");
  await lp.click("button:has-text('Registrar venta')");
  await lp.waitForURL(/error=/);
  assert.match(await lp.textContent("[role=alert]"), /Ya registraste una venta/);
  log("venta registrada y referencia duplicada rechazada");
  await shot(lp, "02-licenciado-ventas");

  // 6. El admin verifica la venta y revisa evidencias.
  await ap.goto(`${APP}/admin/ventas`);
  await ap.locator("tr", { hasText: `IG-${stamp}` }).locator("button:has-text('Verificar')").click();
  await ap.waitForURL(/ok=/);
  await ap.goto(`${APP}/admin/revisiones`);
  await shot(ap, "03-admin-evidencias");
  await ap.locator("article", { hasText: "El primer Reel" }).locator("button:has-text('Aprobar')").click();
  await ap.waitForURL(/ok=/);
  const story = ap.locator("article", { hasText: "Presencia en redes" });
  assert.equal(await story.locator("img").count(), 1, "la captura privada se ve con enlace firmado");
  await story.locator("input[name=reason]").fill("El producto no se identifica en la historia");
  await story.locator("button:has-text('Rechazar')").click();
  await ap.waitForURL(/ok=/);
  log("venta verificada, evidencia aprobada y otra rechazada");

  // 7. El licenciado ve su progreso real.
  await lp.goto(`${APP}/panel/misiones`);
  const text = await lp.textContent("main");
  assert.match(text, /180 XP/);
  assert.match(text, /Motivo del rechazo: El producto no se identifica/);
  assert.match(await lp.locator("article", { hasText: "Primera venta del día" }).textContent(), /Completada/);
  await shot(lp, "04-licenciado-progreso");
  await lp.goto(`${APP}/panel/misiones?tab=weekly`);
  assert.match(await lp.locator("article", { hasText: "Especialista en hoodies" }).textContent(), /2 \/ 10 hoodies/);
  await lp.goto(`${APP}/panel/misiones?tab=xp`);
  assert.equal(await lp.locator("tbody tr").count(), 2);
  await shot(lp, "05-licenciado-historial-xp");
  log("progreso, XP (100 + 80) y motivo de rechazo visibles");

  // 8. El admin crea y duplica una misión desde la app.
  await ap.goto(`${APP}/admin/misiones/nueva`);
  await ap.fill("#code", `E2E${stamp % 10000}`);
  await ap.fill("#title", "Misión especial de lanzamiento");
  await ap.fill("#category", "Contenido");
  await ap.selectOption("#frequency", "weekly");
  await ap.selectOption("#metric", "approved_evidence_count");
  await ap.fill("#target_value", "2");
  await ap.fill("#target_unit", "publicaciones");
  await ap.fill("#xp_reward", "150");
  await ap.fill("#evidence_instructions", "Envía el enlace de cada publicación del lanzamiento.");
  await ap.selectOption("#status", "active");
  await ap.click("button:has-text('Crear misión')");
  await ap.waitForURL(/\/admin\/misiones\/[0-9a-f-]{36}\?ok=/);
  await ap.goto(`${APP}/admin/misiones`);
  await shot(ap, "06-admin-misiones");
  log("misión creada por el administrador");

  await lp.goto(`${APP}/panel/misiones?tab=weekly`);
  assert.equal(await lp.locator("article", { hasText: "Misión especial de lanzamiento" }).count(), 1);
  log("el licenciado ve la nueva misión");

  // 9. Ajuste auditado de XP.
  await ap.goto(`${APP}/admin/xp`);
  await selectByText(ap, "#user_id", new RegExp(LIC.name));
  await ap.fill("#amount", "-30");
  await ap.fill("#reason", "Corrección de prueba E2E");
  await ap.click("button:has-text('Registrar ajuste')");
  await ap.waitForURL(/ok=/);
  const audited = psql(`select count(*) from public.audit_log where action = 'xp.adjusted'`);
  assert.ok(Number(audited) >= 1);
  await ap.goto(`${APP}/admin`);
  await shot(ap, "07-admin-resumen");
  log("ajuste de XP auditado");

  // 10. Aislamiento directo contra la API: un licenciado no ve datos ajenos ni escribe XP.
  const session = await (await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: process.env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: LIC.email, password: LIC.password }),
  })).json();
  const h = { apikey: process.env.ANON_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
  const ins = await fetch(`${API}/rest/v1/xp_ledger`, { method: "POST", headers: h, body: JSON.stringify({ user_id: session.user.id, amount: 9999, transaction_type: "admin_adjustment", description: "hack", idempotency_key: "hack", created_by: session.user.id }) });
  assert.ok(ins.status === 401 || ins.status === 403, `insert xp_ledger devolvió ${ins.status}`);
  const rpc = await fetch(`${API}/rest/v1/rpc/recompute_participation`, { method: "POST", headers: h, body: JSON.stringify({ p_participation_id: "00000000-0000-0000-0000-000000000000" }) });
  assert.ok(rpc.status >= 400, `rpc interna devolvió ${rpc.status}`);
  const audit = await (await fetch(`${API}/rest/v1/audit_log?select=id`, { headers: h })).json();
  assert.deepEqual(audit, []);
  log("API: sin escritura de XP, sin funciones internas, sin auditoría ajena");

  writeFileSync(`${SHOTS}/ok.txt`, "e2e ok\n");
  console.log("\nTodo el flujo de punta a punta pasó.");
} catch (err) {
  await shot(lp, "fail-licenciado").catch(() => {});
  await shot(ap, "fail-admin").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
