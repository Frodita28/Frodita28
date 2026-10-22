"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accountRoles, assignedPasswordSchema, usernameSchema } from "@/lib/accounts";
import { requireAdmin } from "@/lib/auth";
import { provisionAccount, setAccountPassword } from "@/lib/provision";
import { back } from "@/lib/redirect";
import { createAdminClient, serviceRoleConfigured } from "@/lib/supabase/admin";

const PATH = "/admin/usuarios";
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export async function createAccount(formData: FormData) {
  const actor = await requireAdmin();
  if (!serviceRoleConfigured()) back(PATH, "error", "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor");
  const parsed = z
    .object({
      username: usernameSchema,
      password: assignedPasswordSchema,
      role: z.enum(accountRoles),
      full_name: optionalText(120),
      store_name: z.union([z.literal(""), z.string().trim().min(2, "El nombre de la tienda debe tener de 2 a 60 caracteres").max(60)]).optional().default(""),
      plan_id: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const d = parsed.data;
  const result = await provisionAccount(createAdminClient(), {
    username: d.username,
    password: d.password,
    role: d.role,
    fullName: d.full_name || null,
    storeName: d.store_name || null,
    planId: d.plan_id || null,
    actorId: actor.id,
  });
  if ("error" in result) back(PATH, "error", result.error);
  revalidatePath(PATH);
  back(PATH, "ok", `Cuenta “${d.username}” creada. Entrégale su usuario y contraseña por un canal privado.`);
}

export async function resetAccountPassword(formData: FormData) {
  const actor = await requireAdmin();
  if (!serviceRoleConfigured()) back(PATH, "error", "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor");
  const parsed = z.object({ user_id: z.string().uuid(), password: assignedPasswordSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "error", parsed.error.issues[0].message);
  const result = await setAccountPassword(createAdminClient(), parsed.data.user_id, parsed.data.password, actor.id);
  if ("error" in result) back(PATH, "error", result.error);
  back(PATH, "ok", "Contraseña asignada. Entrégala por un canal privado.");
}
