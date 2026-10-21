import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type AppRole = "applicant" | "licensee" | "admin";

export type CurrentUser = {
  id: string;
  email: string | null;
  role: AppRole;
  fullName: string | null;
  publicAlias: string | null;
  /** Nombre de la tienda virtual del licenciado. */
  storeName: string | null;
};

/** Usuario actual con su perfil, o null. El rol se lee de la base de datos, nunca del cliente. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, public_alias, store_name")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    role: profile.role as AppRole,
    fullName: profile.full_name,
    publicAlias: profile.public_alias,
    storeName: profile.store_name,
  };
});

export async function requireUser(next = "/panel") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/panel?error=" + encodeURIComponent("Necesitas permisos de administrador"));
  return user;
}
