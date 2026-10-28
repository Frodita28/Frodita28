/* Textos de la tarjeta «Licencia de tu tienda» (Tu tienda). Solo lectura: muestra los datos de la licencia. */

export const TEXTOS_LICENCIA_TIENDA = {
  titulo: "Licencia de tu tienda",
  etiqueta: "Licencia oficial",
  sello: "GN",
  provisional: "Provisional",
  territorio: "Territorio",
  sinTerritorio: "Sin territorio asignado",
  vigencia: "Vigencia",
  desde: "Desde el",
  sinInicio: "Fecha de inicio por registrar",
  sinCierre: "Sin fecha de cierre",
  contrato: "Contrato",
  contratoPendiente: "Pendiente de registrar",
  contratoRegistrado: "Registrado",
  plan: "Plan",
  sinPlan: "Plan por asignar",
  sinLicencia:
    "Tu tienda todavía no tiene una licencia activa. Gallo Negro revisa cada solicitud y activa la licencia después de formalizar el contrato y el pago.",
  /** Días antes del cierre en que la vigencia se marca como por vencer. */
  avisoDias: 30,
} as const;

export const ESTADO_LICENCIA: Record<string, { texto: string; tono: "success" | "accent" | "alert" | "neutral" }> = {
  active: { texto: "Activa", tono: "success" },
  pending: { texto: "Pendiente de activación", tono: "accent" },
  suspended: { texto: "Suspendida", tono: "alert" },
  expired: { texto: "Vencida", tono: "neutral" },
  cancelled: { texto: "Cancelada", tono: "neutral" },
};

export const ESTADO_PLAN: Record<string, string> = {
  pending_confirmation: "Pendiente de confirmación",
  active: "Vigente",
  inactive: "Inactivo",
};
