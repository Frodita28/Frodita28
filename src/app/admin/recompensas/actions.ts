"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { back, dbMessage, safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalToUtc } from "@/lib/time";

const BASE = "/admin/recompensas";
const ret = (fd: FormData, fallback: string) => safeNext(fd.get("return_to"), fallback);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optInt = (fd: FormData, k: string) => (str(fd, k) === "" ? null : Number.parseInt(str(fd, k), 10));
const localDate = (fd: FormData, k: string) => (str(fd, k) ? (zonedLocalToUtc(str(fd, k))?.toISOString() ?? null) : null);

// -----------------------------------------------------------------------------
// Catálogo
// -----------------------------------------------------------------------------
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function saveProduct(fd: FormData) {
  await requireAdmin();
  const to = ret(fd, `${BASE}/catalogo`);
  const supabase = await createClient();
  const photos = str(fd, "photos")
    .split(/\s+/)
    .filter((u) => /^(https:\/\/|\/)\S+$/.test(u))
    .slice(0, 6);

  const file = fd.get("photo_file");
  if (file instanceof File && file.size > 0) {
    if (!PHOTO_TYPES.includes(file.type) || file.size > 3 * 1024 * 1024) back(to, "error", "La foto debe ser PNG, JPG o WebP de hasta 3 MB");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `premios/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("clan").upload(path, file, { contentType: file.type, upsert: false });
    if (error) back(to, "error", `No se pudo subir la foto: ${error.message}`);
    photos.unshift(supabase.storage.from("clan").getPublicUrl(path).data.publicUrl);
  }

  const parsed = z
    .object({
      name: z.string().min(2, "El nombre es obligatorio").max(80),
      price_gn: z.coerce.number().int().positive("El precio en GN debe ser mayor que 0"),
      tier: z.enum(["calle", "medio", "alto", "premium", "elite"]),
      status: z.enum(["borrador", "programado", "activo", "pausado", "archivado"]),
      kind: z.enum(["fisico", "experiencia", "digital"]),
    })
    .safeParse({ name: str(fd, "name"), price_gn: str(fd, "price_gn"), tier: str(fd, "tier"), status: str(fd, "status"), kind: str(fd, "kind") });
  if (!parsed.success) back(to, "error", parsed.error.issues[0].message);

  const payload = {
    id: str(fd, "id") || null,
    ...parsed.data,
    description: str(fd, "description"),
    photos: photos.slice(0, 6),
    min_rank: optInt(fd, "min_rank"),
    stock: optInt(fd, "stock"),
    limit_per_user: optInt(fd, "limit_per_user"),
    is_permanent: fd.get("is_permanent") === "on",
    needs_address: fd.get("needs_address") === "on",
    available_from: localDate(fd, "available_from"),
    available_until: localDate(fd, "available_until"),
    supplier: str(fd, "supplier"),
    lead_days: optInt(fd, "lead_days"),
    edition_id: str(fd, "edition_id") || null,
    cost_usd: str(fd, "cost_usd") === "" ? null : Number(str(fd, "cost_usd").replace(",", ".")),
  };
  const { data, error } = await supabase.rpc("clan_admin_save_product", { p: payload });
  if (error) back(to, "error", dbMessage(error));
  revalidatePath(`${BASE}/catalogo`);
  revalidatePath("/panel/tienda-clan");
  back(`${BASE}/catalogo?editar=${data}`, "ok", "Premio guardado");
}

export async function duplicateProduct(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clan_admin_duplicate_product", {
    p_product: str(fd, "id"),
    p_edition: str(fd, "edition_id") || null,
  });
  if (error) back(`${BASE}/catalogo`, "error", dbMessage(error));
  revalidatePath(`${BASE}/catalogo`);
  back(`${BASE}/catalogo?editar=${data}`, "ok", "Premio duplicado como borrador");
}

export async function saveEdition(fd: FormData) {
  await requireAdmin();
  const month = str(fd, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) back(`${BASE}/catalogo`, "error", "Elige el mes de la edición");
  const supabase = await createClient();
  const { error } = await supabase.rpc("clan_admin_save_edition", {
    p_month: `${month}-01`,
    p_title: str(fd, "title"),
    p_status: str(fd, "status"),
    p_publish_at: localDate(fd, "publish_at"),
  });
  if (error) back(`${BASE}/catalogo`, "error", dbMessage(error));
  revalidatePath(`${BASE}/catalogo`);
  revalidatePath("/panel/tienda-clan");
  back(`${BASE}/catalogo`, "ok", "Edición guardada");
}

// -----------------------------------------------------------------------------
// Canjes
// -----------------------------------------------------------------------------
export async function setRedemptionStatus(fd: FormData) {
  await requireAdmin();
  const to = ret(fd, `${BASE}/canjes`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("clan_admin_set_status", {
    p_redemption: str(fd, "id"),
    p_status: str(fd, "status"),
    p_note: str(fd, "note") || null,
    p_substitute: str(fd, "substitute") || null,
  });
  if (error) back(to, "error", dbMessage(error));
  revalidatePath(`${BASE}/canjes`);
  back(to, "ok", "Estado del canje actualizado");
}

// -----------------------------------------------------------------------------
// Ventas en revisión y devoluciones
// -----------------------------------------------------------------------------
export async function reviewSale(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const approve = str(fd, "decision") === "aprobar";
  const { error } = await supabase.rpc("gn_review_sale", { p_sale: str(fd, "sale_id"), p_approve: approve, p_note: str(fd, "note") || null });
  if (error) back(`${BASE}/ventas`, "error", dbMessage(error));
  revalidatePath(`${BASE}/ventas`);
  back(`${BASE}/ventas`, "ok", approve ? "Venta aprobada: sus GN se liberan al cumplir la espera" : "Venta anulada y GN revertidos");
}

export async function returnSale(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("gn_return_sale", { p_sale: str(fd, "sale_id"), p_reason: str(fd, "reason") });
  if (error) back(`${BASE}/ventas`, "error", dbMessage(error));
  revalidatePath(`${BASE}/ventas`);
  back(`${BASE}/ventas`, "ok", "Devolución registrada: se descontaron los GN y la venta");
}

// -----------------------------------------------------------------------------
// Validaciones
// -----------------------------------------------------------------------------
export async function startEvidenceReview(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_start_evidence_review", { p_evidence: str(fd, "id") });
  if (error) back(`${BASE}/validaciones`, "error", dbMessage(error));
  revalidatePath(`${BASE}/validaciones`);
  back(`${BASE}/validaciones`, "ok", "Marcada en revisión");
}

export async function decideEvidence(fd: FormData) {
  await requireAdmin();
  const decision = str(fd, "decision");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_decide_evidence", { p_evidence: str(fd, "id"), p_decision: decision, p_reason: str(fd, "reason") || null });
  if (error) back(`${BASE}/validaciones`, "error", dbMessage(error));
  revalidatePath(`${BASE}/validaciones`);
  back(`${BASE}/validaciones`, "ok", decision === "aprobar" ? "Aprobada: se acreditaron XP y GN" : "Decisión registrada");
}

export async function saveValidationRule(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_validation_rule", {
    p_category: str(fd, "category"),
    p_criteria: str(fd, "criteria"),
    p_weekly_limit: optInt(fd, "weekly_limit"),
    p_sla_hours: optInt(fd, "sla_hours"),
  });
  if (error) back(`${BASE}/validaciones`, "error", dbMessage(error));
  revalidatePath(`${BASE}/validaciones`);
  back(`${BASE}/validaciones`, "ok", "Criterios guardados");
}

// -----------------------------------------------------------------------------
// Misiones, licenciatarios y configuración
// -----------------------------------------------------------------------------
export async function setMissionGn(fd: FormData) {
  await requireAdmin();
  const gn = Number.parseInt(str(fd, "gn"), 10);
  if (!Number.isFinite(gn) || gn < 0) back(`${BASE}/misiones`, "error", "GN no válidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("gn_set_mission_gn", { p_mission: str(fd, "id"), p_gn: gn });
  if (error) back(`${BASE}/misiones`, "error", dbMessage(error));
  revalidatePath(`${BASE}/misiones`);
  back(`${BASE}/misiones`, "ok", "GN de la misión actualizados");
}

export async function adjustGn(fd: FormData) {
  await requireAdmin();
  const user = str(fd, "user_id");
  const to = `${BASE}/licenciatarios?u=${user}`;
  const amount = Number.parseInt(str(fd, "amount"), 10);
  if (!Number.isFinite(amount) || amount === 0) back(to, "error", "Cantidad de GN no válida");
  if (str(fd, "reason").length < 5) back(to, "error", "El motivo es obligatorio");
  const supabase = await createClient();
  const { error } = await supabase.rpc("gn_admin_adjust", {
    p_user: user,
    p_amount: amount,
    p_reason: str(fd, "reason"),
    p_idempotency_key: str(fd, "idempotency_key"),
  });
  if (error) back(to, "error", dbMessage(error));
  revalidatePath(`${BASE}/licenciatarios`);
  back(to, "ok", "Ajuste registrado");
}

export async function setIdentity(fd: FormData) {
  await requireAdmin();
  const user = str(fd, "user_id");
  const to = `${BASE}/licenciatarios?u=${user}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_identity", {
    p_user: user,
    p_code: str(fd, "code"),
    p_approve: str(fd, "decision") === "aprobar",
    p_note: str(fd, "note") || null,
  });
  if (error) back(to, "error", dbMessage(error));
  revalidatePath(`${BASE}/licenciatarios`);
  back(to, "ok", "Requisito actualizado");
}

export async function setConfig(fd: FormData) {
  await requireAdmin();
  const key = str(fd, "key");
  const kind = str(fd, "kind");
  const raw = str(fd, "value");
  let value: unknown;
  try {
    if (kind === "number") value = raw === "" ? null : Number(raw.replace(",", "."));
    else if (kind === "boolean") value = fd.get("value") === "on";
    else if (kind === "string") value = raw;
    else value = JSON.parse(raw);
  } catch {
    back(`${BASE}/configuracion`, "error", "El valor no es un JSON válido");
  }
  if (kind === "number" && value !== null && !Number.isFinite(value as number)) back(`${BASE}/configuracion`, "error", "Escribe un número");
  const supabase = await createClient();
  const { error } = await supabase.rpc("gn_set_config", {
    p_key: key,
    p_value: value,
    p_is_draft: fd.get("is_draft") === "on",
  });
  if (error) back(`${BASE}/configuracion`, "error", dbMessage(error));
  revalidatePath(BASE, "layout");
  revalidatePath("/panel", "layout");
  back(`${BASE}/configuracion#${key}`, "ok", "Configuración guardada");
}

export async function setTester(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("gn_config").select("value").eq("key", "recompensas_v3_testers").maybeSingle();
  const current = new Set<string>(Array.isArray(data?.value) ? (data.value as string[]) : []);
  const id = str(fd, "user_id");
  if (str(fd, "action") === "add") current.add(id);
  else current.delete(id);
  const { error } = await supabase.rpc("gn_set_config", { p_key: "recompensas_v3_testers", p_value: [...current], p_is_draft: false });
  if (error) back(`${BASE}/configuracion`, "error", dbMessage(error));
  revalidatePath("/panel", "layout");
  back(`${BASE}/configuracion#recompensas_v3_testers`, "ok", "Lista de prueba actualizada");
}
