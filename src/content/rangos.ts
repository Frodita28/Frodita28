/*
 * Rangos de experiencia del panel de licenciatarios: nombres, cifras, textos e imágenes.
 * Las cifras de XP son las que hay que confirmar; los acumulados se calculan en
 * src/lib/rangos.ts, nunca a mano.
 */

export type RangoSlug = "umbral" | "vigia" | "centurion" | "soberano" | "ayam-cemani";

export type Rango = {
  nivel: number;
  slug: RangoSlug;
  nombre: string;
  /** XP necesarios para COMPLETAR este rango (no el acumulado). */
  xpParaCompletar: number;
  /** Idea de la imagen, para quien la diseñe. */
  concepto: string;
  /**
   * Ruta de la imagen en /public (512×512, fondo transparente). null mientras no exista:
   * se muestra un marcador SVG alusivo al nombre.
   */
  imagen: string | null;
  /** Cosmético que se libera al llegar a este rango (marco del avatar). */
  cosmetico: string;
};

// Nombres de rango y XP para completar cada uno: confirmados por Gallo Negro el 23 oct 2026.
// Lo de cada rango se libera al ALCANZARLO (p. ej. Centurión con 5.000 XP).
export const RANGOS: Rango[] = [
  {
    nivel: 1,
    slug: "umbral",
    nombre: "Umbral",
    xpParaCompletar: 2000,
    concepto: "Puerta o arco entreabierto con luz amarilla entrando",
    imagen: null, // Pendiente: /rangos/umbral.webp cuando exista
    cosmetico: "Marco simple en el avatar",
  },
  {
    nivel: 2,
    slug: "vigia",
    nombre: "Vigía",
    xpParaCompletar: 3000,
    concepto: "Torre de vigilancia con farol, u ojo atento dentro de un escudo",
    imagen: null, // Pendiente: /rangos/vigia.webp cuando exista
    cosmetico: "Marco amarillo",
  },
  {
    nivel: 3,
    slug: "centurion",
    nombre: "Centurión",
    xpParaCompletar: 3500,
    concepto: "Casco de centurión con cresta roja transversal",
    imagen: null, // Pendiente: /rangos/centurion.webp cuando exista
    cosmetico: "Marco doble con detalle rojo",
  },
  {
    nivel: 4,
    slug: "soberano",
    nombre: "Soberano",
    xpParaCompletar: 4000,
    concepto: "Corona cuyas puntas imitan una cresta de gallo",
    imagen: null, // Pendiente: /rangos/soberano.webp cuando exista
    cosmetico: "Marco con brasas animadas",
  },
  {
    nivel: 5,
    slug: "ayam-cemani",
    nombre: "AYAM CEMANI",
    xpParaCompletar: 6000,
    concepto: "Gallo Ayam Cemani completamente negro con aureola dorada",
    imagen: null, // Pendiente: /rangos/ayam-cemani.webp cuando exista
    cosmetico: "Marco máximo e insignia de rango máximo junto al nombre",
  },
];

export type RecompensaNivel = {
  nivel: number;
  titulo: string;
  descripcion: string;
  /**
   * false mientras Gallo Negro no la publique en /panel/recompensas: se muestra como
   * «Próximamente» sin prometer nada concreto.
   */
  publicada: boolean;
};

// Recompensas por rango: aún no definidas por Gallo Negro. El catálogo de /panel/recompensas está vacío;
// ninguna está publicada y por eso no se describe ningún premio concreto.
export const recompensasPorNivel: RecompensaNivel[] = [
  { nivel: 1, titulo: "Recompensa de Umbral", descripcion: "Gallo Negro la anunciará en Recompensas.", publicada: false },
  { nivel: 2, titulo: "Recompensa de Vigía", descripcion: "Gallo Negro la anunciará en Recompensas.", publicada: false },
  { nivel: 3, titulo: "Recompensa de Centurión", descripcion: "Gallo Negro la anunciará en Recompensas.", publicada: false },
  { nivel: 4, titulo: "Recompensa de Soberano", descripcion: "Gallo Negro la anunciará en Recompensas.", publicada: false },
  { nivel: 5, titulo: "Recompensa de AYAM CEMANI", descripcion: "Gallo Negro la anunciará en Recompensas.", publicada: false },
];

/** Textos fijos de la experiencia de rangos y de la clasificación. */
export const TEXTOS_RANGOS = {
  avisoXp: "Los XP no representan dinero ni garantizan beneficios económicos.",
  rangoMaximo: "Rango máximo completado",
  heroEtiqueta: "Tu rango",
  rutaTitulo: "Ruta de rangos",
  rutaAyuda: "Toca un rango para ver qué se libera.",
  liberadoTitulo: "Liberado en tu rango",
  subisteA: "Subiste a",
  verRecompensas: "Ver recompensas",
  cerrar: "Cerrar",
  proximamente: "Próximamente",
  insigniaMaxima: "Rango máximo",
} as const;

/** Textos de la página Clasificación. */
export const TEXTOS_CLASIFICACION = {
  titulo: "Tabla de clasificación",
  subtitulo: "Las tiendas con licencia activa, ordenadas por XP. Suma XP con misiones y escala hasta la cima.",
  privacidad: "Solo se muestran el nombre visible, los XP y el rango de cada tienda.",
  nombrePorDefecto: "Tienda Gallo Negro",
  puestoLibre: "Puesto libre",
  puestoLibreAyuda: "Completa misiones para ocuparlo",
  primeraTienda: "Eres la primera tienda de la tabla. Sube de rango y marca el ritmo para las que vienen.",
  rivalTitulo: "Tu rival",
  liderTitulo: "Vas en cabeza",
  irAMiPosicion: "Ir a mi posición",
  reconocimientos: "Mira los reconocimientos en Recompensas",
  nombreTitulo: "Tu nombre en el ranking",
  nombreAyuda: "Es el único dato que ven otros licenciatarios. Si lo dejas vacío apareces como «Tienda Gallo Negro».",
  nombreMax: 40,
  nombreMin: 2,
  topInicial: 50,
  topMaximo: 200,
} as const;

/**
 * Textos de la parte interactiva de Perfil (misiones de hoy, racha, siguiente jugada,
 * acciones rápidas) y de la navegación móvil del panel.
 */
export const TEXTOS_TIENDA = {
  misionesTitulo: "Misiones de hoy",
  pestanas: { daily: "Diarias", weekly: "Semanales", monthly: "Mensuales" },
  periodo: { daily: "hoy", weekly: "esta semana", monthly: "este mes" },
  estados: { pendiente: "Pendiente", revision: "En revisión", completada: "Completada", no_disponible: "No disponible" },
  enviar: "Enviar",
  reenviar: "Reenviar",
  enviando: "Enviando…",
  verMision: "Ver misión",
  verTodas: "Ver todas",
  verMenos: "Ver menos",
  /** Filas pendientes visibles en móvil antes de «Ver todas». */
  visiblesMovil: 4,
  sinMisionesPeriodo: "No hay misiones en esta sección para tu tienda.",
  sinLicencia: "Necesitas una licencia activa para participar en las misiones.",
  todoCompletado: "Completaste todas las misiones de esta sección.",
  enviadaOk: "Evidencia enviada. Gallo Negro la revisará pronto.",
  errorEnvio: "No se pudo enviar la evidencia. Revisa los datos e inténtalo otra vez.",
  rechazada: "Rechazada: puedes enviar una evidencia nueva.",
  misionCompletada: "Misión completada",
  rachaTitulo: "Racha",
  // BORRADOR: confirma el tono del texto cuando aún no hay racha.
  rachaVacia: "Completa una misión diaria para empezar tu racha.",
  rachaAyuda: "Toca un día para ver qué completaste.",
  sinCompletadasDia: "Ese día no completaste misiones diarias.",
  dias: ["D", "L", "M", "X", "J", "V", "S"],
  siguienteTitulo: "Tu siguiente jugada",
  empezar: "Empezar",
  verMisiones: "Ver misiones",
  todoListo: "Ya completaste lo pendiente de hoy. Mañana hay misiones nuevas.",
  accionesTitulo: "Acciones rápidas",
  accionPos: "Abrir punto de venta",
  accionMisiones: "Mis misiones",
  accionTiendaClan: "Tienda Clan",
  accionRecompensas: "Recompensas",
  proximamente: "Próximamente",
} as const;

/** Navegación inferior del panel en el teléfono. */
export const TEXTOS_NAV = {
  perfil: "Perfil",
  misiones: "Misiones",
  tiendaClan: "Tienda Clan",
  mas: "Más",
  masTitulo: "Más opciones",
  recompensas: "Recompensas",
  contrasena: "Cambiar contraseña",
  administracion: "Administración",
  salir: "Salir",
  cerrar: "Cerrar",
  misionesPendientes: "Tienes misiones diarias pendientes",
} as const;
