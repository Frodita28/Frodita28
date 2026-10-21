// Etiquetas y cálculos de presentación del módulo de misiones (sin dependencias del servidor).

export type Frequency = "daily" | "weekly" | "monthly";
export type ParticipationStatus = "available" | "in_progress" | "pending_review" | "completed" | "rejected" | "expired";
export type Metric =
  | "verified_sales_count"
  | "verified_units"
  | "verified_units_category"
  | "distinct_customers"
  | "recurring_customer_sales"
  | "distinct_sale_days"
  | "categories_with_min_units"
  | "net_sales_growth_pct"
  | "daily_missions_completed"
  | "days_with_completed_daily"
  | "weekly_missions_completed"
  | "approved_evidence_count"
  | "manual_approval";

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
};

export const STATUS_LABEL: Record<ParticipationStatus, string> = {
  available: "Disponible",
  in_progress: "En progreso",
  pending_review: "Pendiente de revisión",
  completed: "Completada",
  rejected: "Rechazada",
  expired: "Vencida",
};

export const MISSION_STATUS_LABEL = {
  draft: "Borrador",
  active: "Activa",
  inactive: "Inactiva",
  archived: "Archivada",
} as const;

export const METRICS: { value: Metric; label: string; method: "auto" | "manual" }[] = [
  { value: "verified_sales_count", label: "Ventas verificadas (número de ventas)", method: "auto" },
  { value: "verified_units", label: "Unidades vendidas verificadas", method: "auto" },
  { value: "verified_units_category", label: "Unidades verificadas de una categoría", method: "auto" },
  { value: "distinct_customers", label: "Clientes distintos con compra verificada", method: "auto" },
  { value: "recurring_customer_sales", label: "Compras de clientes recurrentes", method: "auto" },
  { value: "distinct_sale_days", label: "Días distintos con ventas verificadas", method: "auto" },
  { value: "categories_with_min_units", label: "Categorías con un mínimo de unidades", method: "auto" },
  { value: "net_sales_growth_pct", label: "Crecimiento % de ventas netas vs. período anterior", method: "auto" },
  { value: "daily_missions_completed", label: "Misiones diarias distintas completadas en el día", method: "auto" },
  { value: "days_with_completed_daily", label: "Días con al menos una misión diaria completada", method: "auto" },
  { value: "weekly_missions_completed", label: "Misiones semanales distintas completadas en el mes", method: "auto" },
  { value: "approved_evidence_count", label: "Evidencias aprobadas (cada una suma 1)", method: "manual" },
  { value: "manual_approval", label: "Revisión manual (una evidencia aprobada completa la misión)", method: "manual" },
];

export function metricMethod(metric: string): "auto" | "manual" {
  return METRICS.find((m) => m.value === metric)?.method ?? "manual";
}

export function progressPercent(progress: number | null, target: number): number {
  if (progress === null || !Number.isFinite(progress) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
}

/** Formatea una fecha local (YYYY-MM-DD) como "21 oct 2026". */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${months[m - 1]} ${y}`;
}

export function formatXp(n: number): string {
  return `${new Intl.NumberFormat("es-VE").format(n)} XP`;
}

/** ¿Puede el licenciado enviar evidencia en este estado? */
export function canSubmitEvidence(status: ParticipationStatus, method: "auto" | "manual", periodOpen: boolean) {
  return method === "manual" && periodOpen && (status === "available" || status === "in_progress" || status === "rejected" || status === "pending_review");
}

/** Último día (incluido) del período comparado con "hoy" en la zona de la campaña. */
export function isPeriodOpen(periodEnd: string, todayInTz: string) {
  return todayInTz <= periodEnd;
}

export function todayIn(timezone: string, now = new Date()): string {
  // en-CA produce YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
