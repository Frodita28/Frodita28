/**
 * Contenido de /panel/licencia: todo texto y toda cifra de la página vive aquí.
 *
 * Versión 1.0: cifras, porcentajes y plazos confirmados por Gallo Negro el 22 de octubre de 2026.
 * Si se vuelve a poner `esBorrador` en true, la página muestra la etiqueta "VERSIÓN BORRADOR".
 * El porcentaje de recuperación no se escribe a mano: lo calcula src/lib/licencia.ts con
 * costo = PVP × (1 − margen) y recuperación = inversión / PVP.
 */

export type PlanId = "socio-fundador" | "emprendedor-comercial";

/** Un escalón de compra. El Socio Fundador tiene uno solo; el Emprendedor Comercial, tres. */
export type Escalon = {
  id: string;
  /** Texto corto del escalón para el selector, por ejemplo "Desde $800". */
  etiqueta: string;
  inversionUsd: number;
  /** Margen mínimo garantizado sobre el PVP, de 0 a 1. */
  margenMinimo: number;
  /** Precio de venta al público de la mercancía que recibes con esa inversión. */
  pvpUsd: number;
};

export type Plan = {
  id: PlanId;
  nombre: string;
  /** Cómo se lee la inversión del plan, por ejemplo "inicial" o "por pedido". */
  inversionSufijo: string;
  /** Texto de la tarjeta de inversión cuando el plan tiene varios escalones. */
  inversionResumen: string;
  escalones: Escalon[];
  exclusividad: string;
  vigencia: string;
  /** null = no aplica. */
  recompraAnualMinimaUsd: number | null;
};

export type BeneficioIcono = "swap" | "recycle" | "percent" | "bolt" | "box" | "shield" | "arrowUp" | "trophy";

export type Beneficio = {
  titulo: string;
  descripcion: string;
  icono: BeneficioIcono;
  /** Etiqueta del plan al que aplica. */
  aplicaA: string;
};

export type Clausula = { titulo: string; texto: string; pasos?: string[] };

const AMBOS = "Ambos planes";

export const licencia = {
  version: "1.0",
  vigenteDesde: "22 de octubre de 2026",
  esBorrador: false,

  encabezado: {
    titulo: "Términos de licencia",
    subtitulo: "Todo lo que recibes como licenciatario de Gallo Negro, explicado claro.",
  },

  aviso: "Esta página es un resumen explicativo. El contrato firmado prevalece en caso de diferencia.",
  etiquetaBorrador: "Versión borrador",
  avisoBorrador: "Cifras pendientes de confirmación por Gallo Negro.",

  selectorPlan: {
    titulo: "Elige un plan",
    planInicial: "socio-fundador" as PlanId,
    escalonTitulo: "Escalón de compra",
  },

  planes: [
    {
      id: "socio-fundador",
      nombre: "Socio Fundador",
      inversionSufijo: "inicial",
      inversionResumen: "$1,500 USD inicial",
      escalones: [{ id: "unico", etiqueta: "$1,500", inversionUsd: 1500, margenMinimo: 0.4, pvpUsd: 2500 }],
      exclusividad: "Sí, territorial",
      vigencia: "12 meses renovable",
      recompraAnualMinimaUsd: 1200,
    },
    {
      id: "emprendedor-comercial",
      nombre: "Emprendedor Comercial",
      inversionSufijo: "por pedido",
      inversionResumen: "Desde $800 USD por pedido",
      escalones: [
        { id: "800", etiqueta: "Desde $800", inversionUsd: 800, margenMinimo: 0.3, pvpUsd: 1143 },
        { id: "1500", etiqueta: "Desde $1,500", inversionUsd: 1500, margenMinimo: 0.35, pvpUsd: 2308 },
        { id: "3000", etiqueta: "Desde $3,000", inversionUsd: 3000, margenMinimo: 0.4, pvpUsd: 5000 },
      ],
      exclusividad: "No",
      vigencia: "12 meses",
      recompraAnualMinimaUsd: null,
    },
  ] satisfies Plan[] as Plan[],

  numeros: {
    titulo: "Tu inversión en números",
    inversion: "Inversión",
    margen: "Margen mínimo garantizado sobre el PVP",
    pvp: "PVP de la mercancía",
    costo: "Costo de la mercancía",
    costoNota: "PVP × (1 − margen)",
    recuperacion: "Recuperas tu inversión al vender",
    recuperacionSufijo: "del inventario",
    exclusividad: "Exclusividad de zona",
    vigencia: "Vigencia",
    recompra: "Recompra anual mínima",
    noAplica: "No aplica",
  },

  simulador: {
    titulo: "Simulador de recuperación",
    pregunta: "¿Qué % del inventario vendes?",
    ventas: "Ventas al PVP",
    margen: "Margen ganado",
    recuperado: "Inversión recuperada",
    barra: "Avance hacia la recuperación de tu inversión",
    puntoRecuperacion: "Punto de recuperación",
    mensajeRecuperado: "¡Llegaste al punto de recuperación! Con este nivel de ventas ya recuperaste tu inversión.",
    faltaPrefijo: "Te falta vender",
    faltaSufijo: "del inventario para recuperar tu inversión.",
    descargo: "Simulación ilustrativa. No garantiza ventas ni ganancias.",
    porcentajeInicial: 50,
  },

  beneficios: {
    titulo: "Beneficios",
    lista: [
      {
        titulo: "Cambio de stock",
        icono: "swap",
        aplicaA: AMBOS,
        descripcion:
          "Si a los 90 días algo no rota, puedes cambiar hasta el 20% de tu inventario inicial por otros modelos del catálogo, sin costo. Las prendas deben estar sin uso, con etiquetas y sin daños.",
      },
      {
        titulo: "Recompra de sobrante",
        icono: "recycle",
        aplicaA: AMBOS,
        descripcion:
          "Al cierre de tus 12 meses, Gallo Negro te recompra hasta el 15% de tu inventario inicial que no hayas vendido, al costo de compra menos 10%.",
      },
      {
        titulo: "Bono por volumen",
        icono: "percent",
        aplicaA: AMBOS,
        descripcion:
          "Tus compras acumuladas de cada trimestre te dan crédito en mercancía para tu siguiente pedido: 3% desde $1,500, 5% desde $3,000 y 7% desde $5,000.",
      },
      {
        titulo: "Acceso anticipado a drops",
        icono: "bolt",
        aplicaA: AMBOS,
        descripcion: "Ves y compras cada colección nueva 48 horas antes que el público.",
      },
      {
        titulo: "Kit de arranque",
        icono: "box",
        aplicaA: AMBOS,
        descripcion:
          "Recibes fotos de producto, contenido listo para redes, guía de marca y material de punto de venta para vender desde el primer día.",
      },
      {
        titulo: "Protección de zona",
        icono: "shield",
        aplicaA: "Solo Socio Fundador",
        descripcion:
          "Tu territorio es tuyo. Si Gallo Negro vende online con envío a tu zona, recibes el 10% del valor neto de esa venta.",
      },
      {
        titulo: "Ascenso",
        icono: "arrowUp",
        aplicaA: "De Emprendedor Comercial a Socio Fundador",
        descripcion:
          "Si creces, lo que ya compraste cuenta: el 50% de tus compras de los últimos 12 meses (máximo $750) se descuenta de la inversión de Socio Fundador.",
      },
      {
        titulo: "Programa de reconocimiento",
        icono: "trophy",
        aplicaA: AMBOS,
        descripcion:
          "Compite por premios según tus ventas reales: dinero, mercancía exclusiva, entradas a eventos de pelea y conciertos, y el viaje anual para los mejores licenciatarios.",
      },
    ] satisfies Beneficio[] as Beneficio[],
  },

  reconocimiento: {
    titulo: "Programa de reconocimiento",
    reglas: [
      "Los puntos (XP) se calculan solo con ventas reales verificadas y misiones completadas.",
      "Hay cortes mensual, trimestral y anual; la fecha de cierre se publica en la app.",
      "Compites contra licenciatarios de volumen similar cuando haya suficientes participantes.",
      "Desempate: gana quien tenga mayor venta neta verificada del período; si persiste, quien la alcanzó primero.",
      "Ningún premio depende del azar ni de pagar para participar.",
      "Cada premio se publica en Recompensas con sus requisitos reales antes de abrirse.",
      "Los XP no son dinero ni garantizan beneficios económicos.",
      "No se paga ni se da puntos por reclutar otros licenciatarios.",
    ],
    enlaces: [
      { href: "/panel/rangos", texto: "Ruta de rangos", icono: "podium" },
      { href: "/panel/misiones", texto: "Misiones", icono: "flag" },
      { href: "/panel/recompensas", texto: "Recompensas", icono: "gift" },
    ] as const,
  },

  clausulas: {
    titulo: "Cláusulas para ti",
    lista: [
      {
        titulo: "Reglas por escrito",
        texto:
          "Cómo se calculan los puntos, las fechas de corte y los desempates está publicado y no cambia a mitad de un período sin aviso previo.",
      },
      {
        titulo: "Salida y renovación",
        texto: "Si decides no renovar:",
        pasos: [
          "Gallo Negro te recompra el sobrante según el beneficio 2.",
          "Tienes 60 días para liquidar el resto del inventario respetando el PVP mínimo.",
          "Tu información de ventas queda disponible durante ese plazo.",
        ],
      },
    ] satisfies Clausula[] as Clausula[],
  },

  pie: {
    version: "Versión",
    vigenteDesde: "Vigente desde",
    ley: "El contrato se rige por la ley indicada en el documento firmado.",
  },
};

export type LicenciaContenido = typeof licencia;
