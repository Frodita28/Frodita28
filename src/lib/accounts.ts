import { z } from "zod";

/**
 * Cuentas asignadas por el administrador. No hay registro público: cada persona
 * entra con un nombre de usuario que se guarda en Supabase Auth como un correo
 * interno de este dominio (nadie lo ve ni recibe correos en él).
 */
export const INTERNAL_EMAIL_DOMAIN = "usuarios.gallonegro.local";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,29}$/, "Usuario no válido: de 3 a 30 caracteres (letras, números, punto, guion o guion bajo)");

/**
 * Contraseña que asigna el administrador. El mínimo es el de Supabase Auth (6);
 * una contraseña corta es solo temporal y debe cambiarse antes del uso real.
 */
export const assignedPasswordSchema = z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(72);

/** Contraseña que elige el propio usuario al cambiarla. */
export const ownPasswordSchema = z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(72);

export const accountRoles = ["licensee", "applicant", "admin"] as const;
export type AccountRole = (typeof accountRoles)[number];

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

/** Nombre de usuario de un correo interno, o null si es un correo real. */
export function usernameFromEmail(email: string | null | undefined) {
  const suffix = `@${INTERNAL_EMAIL_DOMAIN}`;
  return email && email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length).toLowerCase() : null;
}

/**
 * Correo con el que se inicia sesión. Se escribe el usuario asignado; un correo
 * completo también vale (p. ej. el de un administrador creado con su correo real).
 */
export function loginEmail(identifier: string): string | null {
  const value = identifier.trim().toLowerCase();
  if (value.includes("@")) return z.string().email().safeParse(value).success ? value : null;
  const username = usernameSchema.safeParse(value);
  return username.success ? usernameToEmail(username.data) : null;
}
