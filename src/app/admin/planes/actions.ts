"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const PATH = "/admin/planes";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalInt = z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).optional().default("");

const planSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre del plan").max(80),
  description: optionalText(1000),
  price: z.union([z.literal(""), z.coerce.number().min(0, "Precio no válido").max(10_000_000)]).optional().default(""),
  currency: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Moneda de 3 letras, p. ej. USD")]).optional().default(""),
  duration_months: optionalInt,
  territory: optionalText(200),
  units_included: optionalInt,
  authorized_products: optionalText(1000),
  exclusivity_terms: optionalText(2000),
  materials_included: optionalText(2000),
  renewal_terms: optionalText(2000),
  status: z.enum(["pending_confirmation", "active", "inactive"]),
  is_demo: z.literal("true").optional(),
  sort_order: z.coerce.number().int().min(0).max(1000).optional().default(0),
});

function planRow(v: z.infer<typeof planSchema>) {
  const orNull = <T,>(x: T | "") => (x === "" ? null : x);
  return {
    name: v.name,
    description: orNull(v.description),
    price: orNull(v.price),
    currency: orNull(v.currency),
    duration_months: orNull(v.duration_months) || null,
    territory: orNull(v.territory),
    units_included: orNull(v.units_included),
    authorized_products: orNull(v.authorized_products),
    exclusivity_terms: orNull(v.exclusivity_terms),
    materials_included: orNull(v.materials_included),
    renewal_terms: orNull(v.renewal_terms),
    status: v.status,
    is_demo: v.is_demo === "true",
    sort_order: v.sort_order,
  };
}

function planError(error: { code?: string; message?: string }) {
  if (/license_plans_active_has_price/.test(error.message ?? "")) return "Para marcar un plan como disponible define precio y moneda";
  if (error.code === "23505") return "Ya existe un plan con ese código";
  return dbMessage(error);
}

export async function savePlan(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) back(PATH, "error", "Plan no válido");
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase.from("license_plans").update(planRow(parsed.data)).eq("id", id.data).select("id");
  if (error) back(PATH, "error", planError(error));
  if (!data?.length) back(PATH, "error", "No tienes permiso para esta acción");
  revalidatePath(PATH);
  revalidatePath("/");
  back(PATH, "ok", `Plan "${parsed.data.name}" guardado`);
}

export async function createPlan(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/, "Código: letras, números y _"), name: z.string().trim().min(2).max(80) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("license_plans").insert({
    code: parsed.data.code,
    name: parsed.data.name,
    status: "pending_confirmation",
    sort_order: 100,
  });
  if (error) back(PATH, "error", planError(error));
  revalidatePath(PATH);
  back(PATH, "ok", "Plan creado como pendiente de confirmación");
}

const benefitStatus = z.enum(["confirmed", "pending_approval", "contract_only"]);

export async function addBenefit(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ plan_id: z.string().uuid(), description: z.string().trim().min(3, "Describe el beneficio").max(300), status: benefitStatus })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("plan_benefits").insert({ ...parsed.data, sort_order: Date.now() % 1_000_000 });
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  revalidatePath("/");
  back(PATH, "ok", "Beneficio añadido");
}

export async function updateBenefit(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), status: benefitStatus, remove: z.literal("true").optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", "Datos no válidos");
  const supabase = await createClient();
  const { error } = parsed.data.remove
    ? await supabase.from("plan_benefits").delete().eq("id", parsed.data.id)
    : await supabase.from("plan_benefits").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) back(PATH, "error", dbMessage(error));
  revalidatePath(PATH);
  revalidatePath("/");
  back(PATH, "ok", parsed.data.remove ? "Beneficio eliminado" : "Beneficio actualizado");
}
