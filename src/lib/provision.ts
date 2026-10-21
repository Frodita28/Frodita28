import type { SupabaseClient } from "@supabase/supabase-js";
import { usernameToEmail, type AccountRole } from "./accounts";

export type NewAccount = {
  username: string;
  password: string;
  role: AccountRole;
  fullName?: string | null;
  storeName?: string | null;
  planId?: string | null;
  /** Administrador que crea la cuenta (queda en la auditoría). */
  actorId?: string | null;
};

/**
 * Crea una cuenta asignada. Necesita un cliente con la service role (solo en el
 * servidor o en un script local): crea el usuario en Supabase Auth ya confirmado
 * y completa su perfil, rol y licencia en la base de datos.
 * Si la base de datos rechaza los datos, se borra el usuario recién creado.
 */
export async function provisionAccount(admin: SupabaseClient, account: NewAccount): Promise<{ id: string } | { error: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(account.username),
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName ?? account.username },
  });
  if (error || !data.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return { error: taken ? "El nombre de usuario ya está en uso" : `No se pudo crear la cuenta: ${error?.message ?? "error desconocido"}` };
  }
  const id = data.user.id;
  const { error: dbError } = await admin.rpc("provision_account", {
    p_user: id,
    p_username: account.username,
    p_role: account.role,
    p_full_name: account.fullName ?? null,
    p_store_name: account.storeName ?? null,
    p_plan_id: account.planId ?? null,
    p_actor: account.actorId ?? null,
  });
  if (dbError) {
    await admin.auth.admin.deleteUser(id);
    return { error: dbError.message || "No se pudo completar la cuenta" };
  }
  return { id };
}

/** Asigna una contraseña nueva a una cuenta (no hay recuperación por correo). */
export async function setAccountPassword(admin: SupabaseClient, userId: string, password: string, actorId: string | null): Promise<{ id: string } | { error: string }> {
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: `No se pudo cambiar la contraseña: ${error.message}` };
  await admin.rpc("write_audit_as", {
    p_actor: actorId,
    p_action: "account.password_set",
    p_entity_type: "profile",
    p_entity_id: userId,
    p_details: {},
  });
  return { id: userId };
}
