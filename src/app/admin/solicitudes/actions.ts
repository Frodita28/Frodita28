"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { back, dbMessage } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

const OK: Record<string, string> = {
  start_review: "Revisión iniciada",
  request_info: "Se pidió información al solicitante",
  approve: "Solicitud aprobada. Activa la licencia cuando estén formalizados contrato y pago.",
  reject: "Solicitud rechazada",
  note: "Nota interna guardada",
};

export async function reviewApplication(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().uuid(),
      action: z.enum(["start_review", "request_info", "approve", "reject", "note"]),
      message: z.string().trim().max(2000).optional().default(""),
      plan_id: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/admin/solicitudes", "error", "Datos no válidos");
  const path = `/admin/solicitudes/${parsed.data.id}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_license_application", {
    p_id: parsed.data.id,
    p_action: parsed.data.action,
    p_message: parsed.data.message || null,
    p_plan_id: parsed.data.plan_id || null,
  });
  if (error) back(path, "error", dbMessage(error));
  revalidatePath("/admin/solicitudes");
  back(path, "ok", OK[parsed.data.action]);
}

export async function activateLicense(formData: FormData) {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().uuid(),
      territory: z.string().trim().max(120).optional().default(""),
      starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indica la fecha de inicio"),
      ends_at: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(""),
      contract_ref: z.string().trim().min(1, "Indica la referencia del contrato firmado").max(120),
      formalized: z.literal("true", { error: "Confirma que el contrato y el pago están formalizados" }),
    })
    .safeParse(Object.fromEntries(formData));
  const id = String(formData.get("id") ?? "");
  const path = z.string().uuid().safeParse(id).success ? `/admin/solicitudes/${id}` : "/admin/solicitudes";
  if (!parsed.success) back(path, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_application_license", {
    p_id: parsed.data.id,
    p_territory: parsed.data.territory || null,
    p_starts_at: parsed.data.starts_at,
    p_ends_at: parsed.data.ends_at || null,
    p_contract_ref: parsed.data.contract_ref,
  });
  if (error) back(path, "error", dbMessage(error));
  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin/licencias");
  back(path, "ok", "Licencia activada. La persona ya es licenciada.");
}
