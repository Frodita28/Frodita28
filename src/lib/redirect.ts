import "server-only";
import { redirect } from "next/navigation";

/** Redirige a una ruta con un mensaje de resultado para <Flash>. */
export function back(path: string, kind: "ok" | "error", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

/** Mensaje legible de un error de Supabase/Postgres (los mensajes de nuestras funciones ya están en español). */
export function dbMessage(error: { message?: string; code?: string } | null | undefined, fallback = "No se pudo completar la operación") {
  if (!error) return fallback;
  if (error.code === "42501" && /permission denied|row-level security/i.test(error.message ?? "")) return "No tienes permiso para esta acción";
  return error.message || fallback;
}

/** Ruta interna segura para redirecciones (evita redirecciones abiertas). */
export function safeNext(next: unknown, fallback = "/panel") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
