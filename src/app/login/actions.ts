"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginEmail } from "@/lib/accounts";
import { createClient } from "@/lib/supabase/server";
import { back, safeNext } from "@/lib/redirect";

const credentials = z.object({
  username: z.string().trim().min(1, "Escribe tu usuario").max(254),
  password: z.string().min(1, "Escribe tu contraseña").max(72),
});

/** No hay registro público: solo entran las cuentas que crea el administrador. */
export async function signIn(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  const next = safeNext(formData.get("next"));
  const loginPath = `/login?next=${encodeURIComponent(next)}`;
  if (!parsed.success) back(loginPath, "error", parsed.error.issues[0].message);
  const email = loginEmail(parsed.data.username);
  // Mismo mensaje para usuario inexistente o contraseña errónea.
  if (!email) back(loginPath, "error", "Usuario o contraseña incorrectos");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) back(loginPath, "error", "Usuario o contraseña incorrectos");
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
