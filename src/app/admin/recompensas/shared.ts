export type ProfileRef = { full_name: string | null; public_alias: string | null } | null;

/** Nombre visible de un licenciatario (alias, nombre o id corto). */
export const nombre = (p: ProfileRef, id: string | null) => p?.public_alias ?? p?.full_name ?? id?.slice(0, 8) ?? "—";

/** Etiquetas de las señales de fraude (marcan, no bloquean). */
export const SENALES: Record<string, string> = {
  rafaga: "Ráfaga de ventas",
  monto_repetido: "Monto repetido",
  mismo_comprador: "Mismo comprador",
  pico: "Pico inusual",
  precio: "Precio fuera de rango",
  ventas_recientes_en_espera: "Ventas recientes aún en espera",
  alertas_abiertas: "Tiene alertas abiertas",
};

export const senal = (f: unknown) => (typeof f === "string" ? (SENALES[f] ?? f) : JSON.stringify(f));
