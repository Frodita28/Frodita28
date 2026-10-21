"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { back, safeNext } from "@/lib/redirect";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido"),
  password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(72),
});

async function origin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${h.get("host")}`;
}

export async function signIn(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  const next = safeNext(formData.get("next"));
  if (!parsed.success) back(`/login?next=${encodeURIComponent(next)}`, "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const msg = /confirm/i.test(error.message) ? "Confirma tu correo antes de iniciar sesión" : "Correo o contraseña incorrectos";
    back(`/login?next=${encodeURIComponent(next)}`, "error", msg);
  }
  redirect(next);
}

export async function signUp(formData: FormData) {
  const schema = credentials.extend({ full_name: z.string().trim().min(2, "Indica tu nombre").max(120) });
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/registro", "error", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Solo el nombre: el rol nunca se toma de los metadatos.
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: `${await origin()}/auth/confirm` },
  });
  if (error) back("/registro", "error", "No se pudo crear la cuenta. Revisa los datos o intenta más tarde.");
  back("/login", "ok", "Te enviamos un correo para verificar tu cuenta.");
}

export async function requestPasswordReset(formData: FormData) {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) back("/recuperar", "error", "Correo no válido");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await origin()}/auth/confirm?next=/nueva-clave`,
  });
  // Misma respuesta exista o no la cuenta, para no revelar correos registrados.
  back("/login", "ok", "Si el correo está registrado, recibirás un enlace para cambiar la contraseña.");
}

export async function updatePassword(formData: FormData) {
  const password = credentials.shape.password.safeParse(formData.get("password"));
  if (!password.success) back("/nueva-clave", "error", password.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) back("/nueva-clave", "error", "No se pudo actualizar la contraseña. Solicita un enlace nuevo.");
  back("/panel", "ok", "Contraseña actualizada");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
