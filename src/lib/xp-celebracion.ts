// Coordina la celebración de Tu tienda: cuando una misión pasa a completada, la etiqueta
// "+N XP" vuela desde su fila hasta el anillo y el anillo espera a que llegue para avanzar.
// Misiones de hoy lo anuncia en un efecto de diseño (useLayoutEffect), que React ejecuta
// antes que los efectos normales del mismo render, donde el hero de rango lo consulta.

let esperaMs = 0;

/** Duración del vuelo de la etiqueta "+N XP" (ms). */
export const VUELO_MS = 900;

export function anunciarVuelo(ms = VUELO_MS) {
  esperaMs = ms;
}

/** Devuelve (y consume) la espera anunciada; 0 si no hay vuelo. */
export function tomarVuelo(): number {
  const v = esperaMs;
  esperaMs = 0;
  return v;
}
