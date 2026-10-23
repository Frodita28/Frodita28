import type { Escalon } from "@/content/licencia";

/** Costo de la mercancía: PVP × (1 − margen). */
export function costoMercancia(e: Pick<Escalon, "pvpUsd" | "margenMinimo">): number {
  return e.pvpUsd * (1 - e.margenMinimo);
}

/** Parte del inventario (0 a 1) que hay que vender al PVP para recuperar la inversión: inversión / PVP. */
export function recuperacion(e: Pick<Escalon, "inversionUsd" | "pvpUsd">): number {
  return e.pvpUsd > 0 ? e.inversionUsd / e.pvpUsd : 0;
}

export type Simulacion = {
  ventasUsd: number;
  margenUsd: number;
  recuperadoUsd: number;
  /** Avance hacia la recuperación, de 0 a 100. */
  avance: number;
  recuperado: boolean;
  /** Puntos porcentuales de inventario que faltan por vender para recuperar la inversión. */
  faltaPct: number;
};

/** Simula ventas al PVP para un porcentaje del inventario vendido (0 a 100). */
export function simular(e: Escalon, porcentajeVendido: number): Simulacion {
  const pct = Math.min(Math.max(porcentajeVendido, 0), 100);
  const ventasUsd = e.pvpUsd * (pct / 100);
  const recuperadoUsd = Math.min(ventasUsd, e.inversionUsd);
  const avance = e.inversionUsd > 0 ? Math.min((ventasUsd / e.inversionUsd) * 100, 100) : 100;
  const puntoPct = Math.round(recuperacion(e) * 100);
  return {
    ventasUsd,
    margenUsd: ventasUsd * e.margenMinimo,
    recuperadoUsd,
    avance,
    recuperado: pct >= puntoPct,
    faltaPct: Math.max(puntoPct - pct, 0),
  };
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "$1,500 USD", como en el contrato. */
export function formatUsd(n: number): string {
  return `${USD.format(Math.round(n))} USD`;
}

/** 0.4 → "40%". */
export function formatPct(fraccion: number): string {
  return `${Math.round(fraccion * 100)}%`;
}

export type Vigencia = {
  /** Días que faltan hasta la fecha de cierre (0 si ya pasó). */
  diasRestantes: number;
  /** Parte transcurrida de la vigencia, de 0 a 1. */
  transcurrido: number;
  /** Quedan 30 días o menos. */
  porVencer: boolean;
};

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
};

/** Avance de la vigencia de una licencia (fechas YYYY-MM-DD). null si no tiene fecha de cierre. */
export function vigencia(inicio: string | null, cierre: string | null, hoy: string, avisoDias = 30): Vigencia | null {
  if (!cierre) return null;
  const fin = dayNumber(cierre);
  const ahora = dayNumber(hoy);
  const ini = inicio ? dayNumber(inicio) : ahora;
  const total = Math.max(fin - ini, 1);
  const diasRestantes = Math.max(fin - ahora, 0);
  return {
    diasRestantes,
    transcurrido: Math.min(Math.max((ahora - ini) / total, 0), 1),
    porVencer: diasRestantes <= avisoDias,
  };
}
