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
