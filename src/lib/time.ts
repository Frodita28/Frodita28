// Conversión entre hora local de una zona y UTC sin dependencias externas.

export const DEFAULT_TZ = "America/Caracas";

function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - at.getTime()) / 60000;
}

/** "2026-10-21T14:30" interpretado en la zona indicada → Date (UTC). */
export function zonedLocalToUtc(local: string, timeZone = DEFAULT_TZ): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Dos pasadas para resolver correctamente los cambios de horario.
  let guess = naive - offsetMinutes(timeZone, new Date(naive)) * 60000;
  guess = naive - offsetMinutes(timeZone, new Date(guess)) * 60000;
  return new Date(guess);
}

/** Date → "2026-10-21T14:30" en la zona indicada (para inputs datetime-local). */
export function utcToZonedLocal(at: Date, timeZone = DEFAULT_TZ): string {
  const shifted = new Date(at.getTime() + offsetMinutes(timeZone, at) * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function formatDateTime(iso: string, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("es-VE", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** Fecha ISO (YYYY-MM-DD, UTC) de hace n días. */
export function daysAgoIso(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
}
