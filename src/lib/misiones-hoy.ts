// Cálculos de la parte interactiva de Tu tienda: misiones del período, racha y siguiente jugada.
// Sin dependencias del servidor: los datos llegan de mission_participations tal como están.

import type { Frequency, ParticipationStatus } from "./missions";
import type { EstadoRango, RangoConUmbral } from "./rangos";

export type MisionHoy = {
  /** Id de la participación; si la tienda no tiene participación (sin licencia), el código de la misión. */
  id: string;
  code: string;
  title: string;
  frequency: Frequency;
  xp: number;
  /** null: la tienda no participa (no hay período abierto para ella). */
  status: ParticipationStatus | null;
  progress: number | null;
  target: number;
  unit: string;
  validation: "auto" | "manual";
  metric: string;
  instructions: string;
  /** La tienda puede enviar (otra) evidencia ahora mismo: mismas reglas que /panel/misiones. */
  canSend: boolean;
};

export type EstadoVisible = "pendiente" | "revision" | "completada" | "no_disponible";

/** Estado que ve el licenciado: pendiente (disponible, en progreso o rechazada), en revisión, completada o no disponible. */
export function estadoVisible(m: Pick<MisionHoy, "status">): EstadoVisible {
  switch (m.status) {
    case "available":
    case "in_progress":
    case "rejected":
      return "pendiente";
    case "pending_review":
      return "revision";
    case "completed":
      return "completada";
    default:
      return "no_disponible";
  }
}

/** Métricas automáticas que no salen de las ventas sino de otras misiones. */
const COMPUESTAS = new Set(["daily_missions_completed", "days_with_completed_daily", "weekly_missions_completed"]);

/**
 * Qué hace el licenciado para avanzar en la misión:
 * - evidencia: envía una evidencia (revisión de Gallo Negro), con el mismo formulario de /panel/misiones.
 * - ventas: se completa sola con las ventas del punto de venta.
 * - automatica: se completa sola al cumplir otras misiones.
 */
export function tipoDeMision(m: Pick<MisionHoy, "validation" | "metric">): "evidencia" | "ventas" | "automatica" {
  if (m.validation === "manual") return "evidencia";
  return COMPUESTAS.has(m.metric) ? "automatica" : "ventas";
}

export const ORDEN_ESTADO: Record<EstadoVisible, number> = { pendiente: 0, revision: 1, completada: 2, no_disponible: 3 };

/** Pendientes primero (las de más XP arriba), luego en revisión, completadas y no disponibles. */
export function ordenarMisiones<T extends MisionHoy>(ms: T[]): T[] {
  return [...ms].sort(
    (a, b) => ORDEN_ESTADO[estadoVisible(a)] - ORDEN_ESTADO[estadoVisible(b)] || b.xp - a.xp || a.code.localeCompare(b.code),
  );
}

export type ResumenMisiones = {
  completadas: number;
  total: number;
  /** XP de las misiones completadas del período. */
  xpGanado: number;
  /** XP que aún se pueden ganar en el período (pendientes y en revisión). */
  xpPosible: number;
};

export function resumenMisiones(ms: MisionHoy[]): ResumenMisiones {
  const disponibles = ms.filter((m) => estadoVisible(m) !== "no_disponible");
  const completadas = disponibles.filter((m) => estadoVisible(m) === "completada");
  return {
    completadas: completadas.length,
    total: disponibles.length,
    xpGanado: completadas.reduce((s, m) => s + m.xp, 0),
    xpPosible: disponibles.filter((m) => estadoVisible(m) !== "completada").reduce((s, m) => s + m.xp, 0),
  };
}

/* ---------- Fechas locales (YYYY-MM-DD) ---------- */

function toUtc(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(toUtc(iso) + dias * 86400000).toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha local. */
export function diaSemana(iso: string): number {
  return new Date(toUtc(iso)).getUTCDay();
}

/** Los últimos 7 días terminando hoy, del más antiguo al más reciente. */
export function ultimos7Dias(hoy: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));
}

/**
 * Días seguidos con al menos una misión diaria completada. Si hoy todavía no hay ninguna,
 * la racha sigue contando desde ayer (hoy aún está en juego).
 */
export function diasDeRacha(dias: Iterable<string>, hoy: string): number {
  const set = new Set(dias);
  let dia = set.has(hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (set.has(dia)) {
    n++;
    dia = sumarDias(dia, -1);
  }
  return n;
}

/* ---------- Siguiente jugada ---------- */

export type SiguienteJugada = {
  /** La misión pendiente de más XP (primero las diarias; si no quedan, semanales y mensuales). */
  mision: MisionHoy | null;
  /** XP de las misiones diarias pendientes (o en revisión) de hoy. */
  xpHoy: number;
  /** Rango al que se llega si se completan las misiones de hoy (null si no alcanza). */
  llegaA: RangoConUmbral | null;
  /** XP que faltan para el siguiente rango (0 en el rango máximo completado). */
  faltan: number;
};

export function siguienteJugada(ms: MisionHoy[], estado: EstadoRango): SiguienteJugada {
  const pendientes = (f: Frequency) =>
    ordenarMisiones(ms.filter((m) => m.frequency === f && estadoVisible(m) === "pendiente"));
  const mision = pendientes("daily")[0] ?? pendientes("weekly")[0] ?? pendientes("monthly")[0] ?? null;
  const xpHoy = ms
    .filter((m) => m.frequency === "daily" && (estadoVisible(m) === "pendiente" || estadoVisible(m) === "revision"))
    .reduce((s, m) => s + m.xp, 0);
  const alcanza = !estado.maximoCompletado && estado.xpRestantes > 0 && xpHoy >= estado.xpRestantes;
  return {
    mision,
    xpHoy,
    // Sin rango siguiente, completar el último rango cuenta como llegar a él.
    llegaA: alcanza ? (estado.siguiente ?? estado.rango) : null,
    faltan: estado.xpRestantes,
  };
}

/* ---------- Celebración ---------- */

/**
 * Misiones que pasaron a completadas desde la última visita (ids vistos como completados antes).
 * Sin registro previo (primera visita o sin almacenamiento) no se celebra nada.
 */
export function nuevasCompletadas<T extends MisionHoy>(vistas: string[] | null, ms: T[]): T[] {
  if (!vistas) return [];
  const antes = new Set(vistas);
  return ms.filter((m) => m.status === "completed" && !antes.has(m.id));
}
