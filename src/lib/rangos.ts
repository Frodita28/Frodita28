// Cálculo del rango de una tienda a partir de su XP total (sin dependencias del servidor).

import { RANGOS, type Rango } from "@/content/rangos";

export type RangoConUmbral = Rango & {
  /** XP acumulado con el que se entra en este rango. */
  xpInicio: number;
  /** XP acumulado con el que se completa (y se sube al siguiente). */
  xpFin: number;
};

export type EstadoRango = {
  rango: RangoConUmbral;
  siguiente: RangoConUmbral | null;
  totalXp: number;
  /** XP ganados dentro del rango actual (tope: los XP para completarlo). */
  xpEnRango: number;
  /** Progreso dentro del rango actual, de 0 a 1. */
  progreso: number;
  /** XP que faltan para completar el rango actual (0 en el máximo completado). */
  xpRestantes: number;
  /** El último rango está completo: el anillo queda lleno y no hay nivel siguiente. */
  maximoCompletado: boolean;
};

/** Rangos con sus umbrales acumulados, calculados a partir de los XP de cada rango. */
export function rangosConUmbral(rangos: Rango[] = RANGOS): RangoConUmbral[] {
  let acumulado = 0;
  return rangos.map((r) => {
    const xpInicio = acumulado;
    acumulado += Math.max(0, r.xpParaCompletar);
    return { ...r, xpInicio, xpFin: acumulado };
  });
}

const UMBRALES = rangosConUmbral();

/** Rango, progreso y XP restantes para un total de XP. Los XP negativos o no numéricos cuentan como 0. */
export function estadoRango(totalXp: number, rangos: RangoConUmbral[] = UMBRALES): EstadoRango {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  const ultimo = rangos.length - 1;
  const i = Math.max(0, rangos.findIndex((r, idx) => xp < r.xpFin || idx === ultimo));
  const rango = rangos[i];
  const tramo = rango.xpFin - rango.xpInicio;
  const xpEnRango = Math.min(xp - rango.xpInicio, tramo);
  const maximoCompletado = i === ultimo && xp >= rango.xpFin;
  return {
    rango,
    siguiente: rangos[i + 1] ?? null,
    totalXp: xp,
    xpEnRango,
    progreso: tramo > 0 ? xpEnRango / tramo : 1,
    xpRestantes: Math.max(rango.xpFin - xp, 0),
    maximoCompletado,
  };
}

/** Rangos que se cruzan al pasar de `antes` a `despues` XP (vacío si no se sube de nivel). */
export function rangosAlcanzados(antes: number, despues: number, rangos: RangoConUmbral[] = UMBRALES): RangoConUmbral[] {
  const a = estadoRango(antes, rangos).rango.nivel;
  const d = estadoRango(despues, rangos).rango.nivel;
  return rangos.filter((r) => r.nivel > a && r.nivel <= d);
}

/** Todos los rangos con sus umbrales (para la ruta de rangos y los filtros por liga). */
export function todosLosRangos(): RangoConUmbral[] {
  return UMBRALES;
}

export function rangoPorSlug(slug: string): RangoConUmbral | undefined {
  return UMBRALES.find((r) => r.slug === slug);
}
