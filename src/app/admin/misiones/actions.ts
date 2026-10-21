"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { missionFromForm } from "@/lib/mission-form";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

async function planIds() {
  const supabase = await createClient();
  const { data } = await supabase.from("license_plans").select("id");
  return (data ?? []).map((p) => p.id as string);
}

export async function saveMission(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") ? String(formData.get("id")) : null;
  const errorPath = id ? `/admin/misiones/${id}` : "/admin/misiones/nueva";
  const result = missionFromForm(formData, await planIds());
  if (!result.ok) back(errorPath, "error", result.error);

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("missions").update(result.row).eq("id", id);
    if (error) back(errorPath, "error", error.code === "23505" ? "Ya existe una misión con ese código" : dbMessage(error));
    revalidatePath("/admin/misiones");
    back(`/admin/misiones/${id}`, "ok", "Misión guardada. Los cambios aplican a los períodos nuevos; las participaciones abiertas conservan su objetivo y XP.");
  }
  const { data, error } = await supabase.from("missions").insert(result.row).select("id").single();
  if (error) back(errorPath, "error", error.code === "23505" ? "Ya existe una misión con ese código" : dbMessage(error));
  revalidatePath("/admin/misiones");
  redirect(`/admin/misiones/${data.id}?ok=${encodeURIComponent("Misión creada")}`);
}

export async function setMissionStatus(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(["draft", "active", "inactive", "archived"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/misiones", "error", "Datos no válidos");
  const supabase = await createClient();
  const { error } = await supabase.from("missions").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) back("/admin/misiones", "error", dbMessage(error));
  revalidatePath("/admin/misiones");
  back("/admin/misiones", "ok", parsed.data.status === "active" ? "Misión activada" : "Estado actualizado");
}

export async function duplicateMission(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), new_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/, "Código no válido") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/misiones", "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_mission", { p_mission_id: parsed.data.id, p_new_code: parsed.data.new_code });
  if (error) back("/admin/misiones", "error", error.code === "23505" ? "Ya existe una misión con ese código" : dbMessage(error));
  revalidatePath("/admin/misiones");
  redirect(`/admin/misiones/${data}?ok=${encodeURIComponent("Misión duplicada como borrador")}`);
}
