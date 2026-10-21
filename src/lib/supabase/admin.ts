import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/** ¿Está configurada la service role? Sin ella no se pueden crear cuentas desde la app. */
export function serviceRoleConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Cliente con la service role: se salta RLS. Solo para administrar cuentas de
 * Supabase Auth, siempre después de comprobar requireAdmin() en el servidor.
 * La clave nunca lleva el prefijo NEXT_PUBLIC_, así que no llega al navegador.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");
  return createClient(supabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
