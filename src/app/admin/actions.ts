"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function reviewEvidence(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ evidence_id: z.string().uuid(), decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(500).optional().default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/revisiones", "error", "Datos no válidos");
  if (parsed.data.decision === "reject" && !parsed.data.reason) back("/admin/revisiones", "error", "Indica el motivo del rechazo");
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_mission_evidence", {
    p_evidence_id: parsed.data.evidence_id,
    p_approve: parsed.data.decision === "approve",
    p_reason: parsed.data.reason || null,
  });
  if (error) back("/admin/revisiones", "error", dbMessage(error));
  revalidatePath("/admin/revisiones");
  back("/admin/revisiones", "ok", parsed.data.decision === "approve" ? "Evidencia aprobada" : "Evidencia rechazada");
}

export async function reviewSale(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ sale_id: z.string().uuid(), decision: z.enum(["approve", "reject"]), reason: z.string().trim().max(500).optional().default("") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/ventas", "error", "Datos no válidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_sale", {
    p_sale_id: parsed.data.sale_id,
    p_approve: parsed.data.decision === "approve",
    p_reason: parsed.data.reason || null,
  });
  if (error) back("/admin/ventas", "error", dbMessage(error));
  revalidatePath("/admin/ventas");
  back("/admin/ventas", "ok", parsed.data.decision === "approve" ? "Venta verificada" : "Venta rechazada");
}

export async function cancelSaleAdmin(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ sale_id: z.string().uuid(), reason: z.string().trim().min(3, "Indica el motivo").max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/ventas?status=verified", "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_sale", { p_sale_id: parsed.data.sale_id, p_reason: parsed.data.reason });
  if (error) back("/admin/ventas?status=verified", "error", dbMessage(error));
  revalidatePath("/admin/ventas");
  back("/admin/ventas?status=verified", "ok", "Venta anulada. Si ya había generado XP, revisa las alertas.");
}

export async function adjustXp(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      user_id: z.string().uuid("Elige un licenciado"),
      amount: z.coerce.number().int().refine((n) => n !== 0 && Math.abs(n) <= 100000, "Cantidad no válida"),
      reason: z.string().trim().min(5, "Describe el motivo del ajuste").max(500),
      idempotency_key: z.string().uuid(),
      participation_id: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/xp", "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_xp", {
    p_user: parsed.data.user_id,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_idempotency_key: parsed.data.idempotency_key,
    p_participation_id: parsed.data.participation_id || null,
  });
  if (error) back("/admin/xp", "error", dbMessage(error));
  revalidatePath("/admin/xp");
  back("/admin/xp", "ok", "Ajuste registrado en el historial y la auditoría");
}

export async function resolveFlag(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({ flag_id: z.coerce.number().int().positive(), resolution: z.string().trim().min(3, "Describe la resolución").max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/xp", "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_fraud_flag", { p_flag_id: parsed.data.flag_id, p_resolution: parsed.data.resolution });
  if (error) back("/admin/xp", "error", dbMessage(error));
  revalidatePath("/admin/xp");
  back("/admin/xp", "ok", "Alerta resuelta");
}

export async function saveLicense(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      user_id: z.string().uuid("Elige un usuario"),
      plan_id: z.string().uuid("Elige un plan"),
      territory: z.string().trim().max(120).optional().default(""),
      status: z.enum(["pending", "active", "suspended", "expired", "cancelled"]),
      starts_at: z.string().optional().default(""),
      ends_at: z.string().optional().default(""),
      contract_ref: z.string().trim().max(120).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/licencias", "error", parsed.error.issues[0].message);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("licenses").insert({
    user_id: v.user_id,
    plan_id: v.plan_id,
    territory: v.territory || null,
    status: v.status,
    starts_at: v.starts_at || null,
    ends_at: v.ends_at || null,
    contract_ref: v.contract_ref || null,
  });
  if (error) back("/admin/licencias", "error", error.code === "23505" ? "Ese usuario ya tiene una licencia activa" : dbMessage(error));
  revalidatePath("/admin/licencias");
  back("/admin/licencias", "ok", "Licencia registrada");
}

export async function setLicenseStatus(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(["pending", "active", "suspended", "expired", "cancelled"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/licencias", "error", "Datos no válidos");
  const supabase = await createClient();
  const { error } = await supabase.from("licenses").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) back("/admin/licencias", "error", error.code === "23505" ? "Ese usuario ya tiene otra licencia activa" : dbMessage(error));
  revalidatePath("/admin/licencias");
  back("/admin/licencias", "ok", "Estado de la licencia actualizado");
}
