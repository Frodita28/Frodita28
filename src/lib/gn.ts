/*
 * GN del club: funciones puras (sin servidor) que replican las reglas del libro en SQL
 * (supabase/migrations/20261110000010_gn_libro.sql y siguientes). Las pantallas las usan
 * para explicar cifras y las pruebas comprueban que dan lo mismo que la base de datos.
 * Ninguna de estas funciones cambia saldos: eso solo ocurre en el servidor.
 */

export type ModoVenta = "por_venta" | "por_prenda" | "por_dolar";

/** Configuración pública del programa (gn_public_config). Las cifras BORRADOR viven en gn_config. */
export type GnConfig = {
  gn_modo_venta: ModoVenta;
  gn_por_unidad: number;
  gn_por_dolar: number;
  gn_venta_minima_usd: number;
  gn_max_diario: number;
  gn_misiones_tope_diario: number;
  gn_dias_espera: number;
  gn_meses_vencimiento: number;
  gn_avisos_vencimiento: number[];
  pvp_defecto_usd: number;
  rangos: { nivel: number; xp: number; ventas: number }[];
  beneficios_rango: Record<string, string[]>;
  canjes_por_dia: number;
  validacion_sla_horas: number;
};

/** Valores iniciales (BORRADOR), por si la configuración aún no llega. */
export const GN_CONFIG_INICIAL: GnConfig = {
  gn_modo_venta: "por_prenda",
  gn_por_unidad: 12,
  gn_por_dolar: 0.343,
  gn_venta_minima_usd: 15,
  gn_max_diario: 20,
  gn_misiones_tope_diario: 20,
  gn_dias_espera: 7,
  gn_meses_vencimiento: 12,
  gn_avisos_vencimiento: [60, 30],
  pvp_defecto_usd: 35,
  rangos: [
    { nivel: 1, xp: 0, ventas: 0 },
    { nivel: 2, xp: 2000, ventas: 1500 },
    { nivel: 3, xp: 5000, ventas: 4500 },
    { nivel: 4, xp: 8500, ventas: 12000 },
    { nivel: 5, xp: 12500, ventas: 30000 },
  ],
  beneficios_rango: {},
  canjes_por_dia: 3,
  validacion_sla_horas: 72,
};

export function leerConfig(raw: Partial<Record<keyof GnConfig, unknown>> | null | undefined): GnConfig {
  const c = { ...GN_CONFIG_INICIAL };
  if (!raw) return c;
  for (const k of Object.keys(c) as (keyof GnConfig)[]) {
    const v = raw[k];
    if (v === undefined || v === null) continue;
    (c as Record<string, unknown>)[k] = v;
  }
  return c;
}

const NUM = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 });
const NUM2 = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Cifra con punto de miles: 2800 → «2.800». */
export function formatNum(n: number): string {
  return NUM.format(Math.round(n));
}

/** «2.800 GN». */
export function formatGn(n: number): string {
  return `${formatNum(n)} GN`;
}

/** «$1.500». */
export function formatUsd(n: number, decimales = false): string {
  const signo = n < 0 ? "−" : "";
  return `${signo}$${decimales ? NUM2.format(Math.abs(n)) : formatNum(Math.abs(n))}`;
}

// -----------------------------------------------------------------------------
// Ganancia
// -----------------------------------------------------------------------------

/**
 * GN de una venta (igual que gn_sale_amount en SQL).
 * unidades = prendas cuyo PVP alcanza el mínimo; pvpUnidades = PVP de esas prendas;
 * pvpTicket = PVP del ticket completo; usadasHoy = prendas (o tickets) con GN ya usados hoy.
 */
export function gnPorVenta(
  cfg: Pick<GnConfig, "gn_modo_venta" | "gn_por_unidad" | "gn_por_dolar" | "gn_venta_minima_usd" | "gn_max_diario">,
  venta: { unidades: number; pvpUnidades: number; pvpTicket: number; usadasHoy: number },
): { unidadesConGn: number; gn: number } {
  const hueco = Math.max(cfg.gn_max_diario - venta.usadasHoy, 0);
  if (cfg.gn_modo_venta === "por_prenda") {
    const unidadesConGn = Math.min(venta.unidades, hueco);
    return { unidadesConGn, gn: unidadesConGn * cfg.gn_por_unidad };
  }
  const cuenta = venta.pvpTicket >= cfg.gn_venta_minima_usd && hueco > 0 ? 1 : 0;
  if (cfg.gn_modo_venta === "por_venta") return { unidadesConGn: cuenta, gn: cuenta * cfg.gn_por_unidad };
  return { unidadesConGn: cuenta, gn: cuenta ? Math.floor(venta.pvpUnidades * cfg.gn_por_dolar) : 0 };
}

/** GN de una misión con el tope diario (igual que gn_credit_mission). */
export function gnPorMision(ofrecidos: number, usadosHoy: number, topeDiario: number): number {
  return Math.max(Math.min(ofrecidos, topeDiario - usadosHoy), 0);
}

/** GN que da una venta típica de una prenda al PVP por defecto (para «≈ N ventas»). */
export function gnPorVentaTipica(cfg: GnConfig): number {
  return gnPorVenta(cfg, { unidades: 1, pvpUnidades: cfg.pvp_defecto_usd, pvpTicket: cfg.pvp_defecto_usd, usadasHoy: 0 }).gn;
}

/** Ventas (o prendas) típicas que hacen falta para juntar N GN. */
export function ventasParaGn(gn: number, cfg: GnConfig): number {
  const porVenta = gnPorVentaTipica(cfg);
  if (gn <= 0) return 0;
  return porVenta > 0 ? Math.ceil(gn / porVenta) : Infinity;
}

// -----------------------------------------------------------------------------
// Espera, saldo, reversiones y vencimiento
// -----------------------------------------------------------------------------

const DIA = 86_400_000;

/** Fecha en que se liberan los GN de una venta. */
export function fechaLiberacion(creada: Date, diasEspera: number): Date {
  return new Date(creada.getTime() + diasEspera * DIA);
}

/** ¿Se liberan ya? Una venta en revisión nunca se libera sola. */
export function seLibera(estado: "en_espera" | "en_revision" | "liberada" | "anulada", liberaEn: Date, ahora = new Date()): boolean {
  return estado === "en_espera" && liberaEn.getTime() <= ahora.getTime();
}

export type Saldo = { disponible: number; pendiente: number; retenido: number; porCubrir: number };

/** Acredita GN disponibles: primero cubren el saldo por cubrir (igual que gn_credit_available). */
export function acreditar(s: Saldo, gn: number, desdePendiente = false): Saldo {
  const pago = Math.min(s.porCubrir, gn);
  return {
    disponible: s.disponible + gn - pago,
    pendiente: s.pendiente - (desdePendiente ? gn : 0),
    retenido: s.retenido,
    porCubrir: s.porCubrir - pago,
  };
}

/** Revierte GN disponibles: lo que no alcanza queda por cubrir (igual que gn_debit_available). */
export function revertir(s: Saldo, gn: number): Saldo {
  const quita = Math.min(s.disponible, gn);
  return { ...s, disponible: s.disponible - quita, porCubrir: s.porCubrir + gn - quita };
}

export type Lote = { id: number; restante: number; vence: Date };

/** Consume GN de los lotes del más antiguo al más nuevo. Lanza si no alcanza. */
export function consumirLotes(lotes: Lote[], gn: number): { lotes: Lote[]; usados: { id: number; gn: number }[] } {
  let falta = gn;
  const usados: { id: number; gn: number }[] = [];
  const orden = [...lotes].sort((a, b) => a.vence.getTime() - b.vence.getTime() || a.id - b.id);
  const res = orden.map((l) => {
    if (falta <= 0 || l.restante <= 0) return l;
    const toma = Math.min(l.restante, falta);
    falta -= toma;
    usados.push({ id: l.id, gn: toma });
    return { ...l, restante: l.restante - toma };
  });
  if (falta > 0) throw new Error("Saldo insuficiente");
  return { lotes: res, usados };
}

/** GN que vencen hasta una fecha (para «por vencer en 30 días»). */
export function porVencer(lotes: Lote[], hasta: Date): number {
  return lotes.filter((l) => l.restante > 0 && l.vence.getTime() <= hasta.getTime()).reduce((s, l) => s + l.restante, 0);
}

/** Retiene el precio de un canje (sale del disponible al retenido). */
export function retener(s: Saldo, precio: number): Saldo {
  if (s.porCubrir > 0) throw new Error("Tienes saldo por cubrir");
  if (s.disponible < precio) throw new Error("Saldo insuficiente");
  return { ...s, disponible: s.disponible - precio, retenido: s.retenido + precio };
}

/** Devuelve un canje rechazado o cancelado (del retenido al disponible). */
export function devolver(s: Saldo, precio: number): Saldo {
  return { ...s, disponible: s.disponible + precio, retenido: s.retenido - precio };
}

/** Confirma un canje entregado (sale del retenido). */
export function confirmar(s: Saldo, precio: number): Saldo {
  return { ...s, retenido: s.retenido - precio };
}

// -----------------------------------------------------------------------------
// Canjes
// -----------------------------------------------------------------------------

export type EstadoTarjeta =
  | { tipo: "canjear" }
  | { tipo: "faltan"; gn: number; ventas: number }
  | { tipo: "bloqueado"; rango: number }
  | { tipo: "agotado" }
  | { tipo: "limite" };

/** Estado de la tarjeta de un premio para un licenciatario. */
export function estadoPremio(
  p: { precio: number; rangoMinimo: number; stock: number | null; canjeados: number; limite: number | null },
  u: { nivel: number; disponible: number },
  cfg: GnConfig,
): EstadoTarjeta {
  if (u.nivel < p.rangoMinimo) return { tipo: "bloqueado", rango: p.rangoMinimo };
  if (p.stock !== null && p.stock <= 0) return { tipo: "agotado" };
  if (p.limite !== null && p.canjeados >= p.limite) return { tipo: "limite" };
  if (u.disponible < p.precio) {
    const gn = p.precio - u.disponible;
    return { tipo: "faltan", gn, ventas: ventasParaGn(gn, cfg) };
  }
  return { tipo: "canjear" };
}

// -----------------------------------------------------------------------------
// Control de costo (solo administración)
// -----------------------------------------------------------------------------

/** Porcentaje del costo de premios sobre las ventas (0 si no hay ventas). */
export function costoPct(costoCanjesUsd: number, ventasUsd: number): number {
  return ventasUsd > 0 ? (costoCanjesUsd / ventasUsd) * 100 : 0;
}

/** Ayuda del formulario de producto: ventas equivalentes y % que devuelve. */
export function ayudaProducto(
  precioGn: number,
  costoUsd: number | null,
  cfg: GnConfig,
  valorInternoUsd: number,
): { ventas: number; gnPorVenta: number; devuelvePct: number | null; valorGnUsd: number } {
  const porVenta = gnPorVentaTipica(cfg);
  const ventas = porVenta > 0 ? Math.ceil(precioGn / porVenta) : 0;
  const vendido = ventas * cfg.pvp_defecto_usd;
  const devuelvePct = costoUsd !== null && vendido > 0 ? (costoUsd / vendido) * 100 : null;
  return { ventas, gnPorVenta: porVenta, devuelvePct, valorGnUsd: precioGn * valorInternoUsd };
}

/** Utilidad por prenda antes y después de premios. */
export function utilidadPorPrenda(
  precioBaseUsd: number,
  costoProduccionUsd: number,
  costoPremiosUsd: number,
  prendas: number,
): { antes: number; premiosPorPrenda: number; despues: number } {
  const antes = precioBaseUsd - costoProduccionUsd;
  const premiosPorPrenda = prendas > 0 ? costoPremiosUsd / prendas : 0;
  return { antes, premiosPorPrenda, despues: antes - premiosPorPrenda };
}

// -----------------------------------------------------------------------------
// Rango con doble candado (XP + ventas + identidad); se calcula también en SQL (rank_state)
// -----------------------------------------------------------------------------

export type EntradaRango = {
  xp: number;
  ventas: number;
  /** Niveles cuyo requisito de identidad está cumplido (todos sus requisitos aprobados). */
  identidadCumplida: (nivel: number) => boolean;
  /** Nivel más alto ya alcanzado (el rango nunca baja). */
  alcanzado: number;
};

/** Nivel calculado: el más alto con XP, ventas e identidad cumplidos, sin saltarse ninguno. */
export function nivelCalculado(e: EntradaRango, rangos: GnConfig["rangos"]): number {
  let nivel = 1;
  for (const r of [...rangos].sort((a, b) => a.nivel - b.nivel)) {
    if (r.nivel <= 1) continue;
    if (e.xp >= r.xp && e.ventas >= r.ventas && e.identidadCumplida(r.nivel)) nivel = r.nivel;
    else break;
  }
  return nivel;
}

/** Nivel que se muestra: nunca baja de lo ya alcanzado. */
export function nivelMostrado(e: EntradaRango, rangos: GnConfig["rangos"]): number {
  return Math.max(nivelCalculado(e, rangos), e.alcanzado, 1);
}

/** Lo que falta para un rango: XP, ventas y si falta identidad. */
export function faltaPara(nivel: number, e: EntradaRango, rangos: GnConfig["rangos"]) {
  const r = rangos.find((x) => x.nivel === nivel);
  if (!r) return null;
  return {
    xp: Math.max(r.xp - e.xp, 0),
    ventas: Math.max(r.ventas - e.ventas, 0),
    identidad: !e.identidadCumplida(nivel),
    metaXp: r.xp,
    metaVentas: r.ventas,
  };
}
