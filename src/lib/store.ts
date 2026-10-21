// Resumen de "Tu Tienda" tal como lo devuelve public.store_summary.

export type StoreLevel = { name: string; position: number; minimum_xp: number };

export type StoreMonth = { month: string; revenue: number; units: number };

export type StoreSummary = {
  totalXp: number;
  levelsConfigured: boolean;
  level: StoreLevel | null;
  nextLevel: StoreLevel | null;
  unitsSold: number;
  revenue: number;
  /** Puede ser negativo si hay ventas verificadas sin entrega registrada. */
  stockBalance: number;
  unitsDelivered: number;
  investment: number;
  monthly: StoreMonth[];
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const level = (v: unknown): StoreLevel | null => {
  if (!v || typeof v !== "object") return null;
  const l = v as Record<string, unknown>;
  return { name: String(l.name ?? ""), position: num(l.position), minimum_xp: num(l.minimum_xp) };
};

/** Convierte el JSON de la base en números seguros; lo que falte queda en 0. */
export function parseStoreSummary(raw: unknown): StoreSummary {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    totalXp: num(r.total_xp),
    levelsConfigured: r.levels_configured === true,
    level: level(r.level),
    nextLevel: level(r.next_level),
    unitsSold: num(r.units_sold),
    revenue: num(r.revenue),
    stockBalance: num(r.stock_balance),
    unitsDelivered: num(r.units_delivered),
    investment: num(r.investment),
    monthly: Array.isArray(r.monthly)
      ? r.monthly.map((m: Record<string, unknown>) => ({ month: String(m.month), revenue: num(m.revenue), units: num(m.units) }))
      : [],
  };
}

export const money = (n: number) =>
  new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const units = (n: number) => `${new Intl.NumberFormat("es-VE").format(n)} ${n === 1 ? "prenda" : "prendas"}`;

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10" → "oct" (corto) o "octubre de 2026" (largo). */
export function monthLabel(month: string, long = false) {
  const [y, m] = month.split("-").map(Number);
  const name = MONTHS[(m || 1) - 1];
  return long ? `${name} de ${y}` : name.slice(0, 3);
}

/** Escala "bonita" para el eje: máximo redondeado hacia arriba (1, 2, 2.5, 5 × 10^n). */
export function niceMax(value: number) {
  if (value <= 0) return 0;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value) ?? 10;
  return step * exp;
}
