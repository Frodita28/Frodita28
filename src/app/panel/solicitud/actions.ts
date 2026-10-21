"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applicationFromForm, type ApplicationInput } from "@/lib/applications";
import { requireUser } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const PATH = "/panel/solicitud";

function payload(v: ApplicationInput) {
  return { ...v, preferred_plan_id: v.preferred_plan_id || null };
}

export async function submitApplication(formData: FormData) {
  await requireUser(PATH);
  const parsed = applicationFromForm(formData);
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  if (formData.get("acknowledged") !== "true") back(PATH, "error", "Debes confirmar que entiendes las condiciones de la solicitud");
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_license_application", { p: { ...payload(parsed.data), acknowledged: true } });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  back(PATH, "ok", "Solicitud enviada. Te avisaremos aquí de cada cambio.");
}

export async function updateApplication(formData: FormData) {
  await requireUser(PATH);
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = applicationFromForm(formData);
  if (!id.success) back(PATH, "error", "Solicitud no válida");
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_license_application", { p_id: id.data, p: payload(parsed.data) });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  back(PATH, "ok", "Solicitud actualizada");
}

export async function withdrawApplication(formData: FormData) {
  await requireUser(PATH);
  const parsed = z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).optional().default("") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", "Datos no válidos");
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_license_application", { p_id: parsed.data.id, p_reason: parsed.data.reason || null });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  back(PATH, "ok", "Solicitud retirada");
}
