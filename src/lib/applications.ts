import { z } from "zod";

export type ApplicationStatus = "submitted" | "in_review" | "needs_info" | "approved" | "rejected" | "withdrawn";
export type Tone = "neutral" | "bronze" | "ok" | "warn" | "bad";

export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: Tone; help: string }> = {
  submitted: { label: "Pendiente", tone: "warn", help: "Recibimos tu solicitud. El equipo la revisará pronto." },
  in_review: { label: "En revisión", tone: "bronze", help: "El equipo de Gallo Negro está revisando tu solicitud." },
  needs_info: { label: "Requiere información", tone: "warn", help: "Necesitamos que completes o corrijas algunos datos." },
  approved: {
    label: "Aprobada",
    tone: "ok",
    help: "Tu solicitud fue aprobada. Gallo Negro te contactará para formalizar contrato y pago; la licencia se activa después.",
  },
  rejected: { label: "Rechazada", tone: "bad", help: "Tu solicitud no fue aprobada. Puedes enviar una nueva más adelante." },
  withdrawn: { label: "Retirada", tone: "neutral", help: "Retiraste esta solicitud." },
};

export const OPEN_STATUSES: ApplicationStatus[] = ["submitted", "in_review", "needs_info", "approved"];

export const SALES_CHANNELS = [
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["whatsapp", "WhatsApp"],
  ["presencial", "Venta presencial"],
  ["recurrentes", "Clientes recurrentes"],
  ["eventos", "Eventos"],
  ["tienda_online", "Tienda en línea"],
  ["otro", "Otro"],
] as const;

export const channelLabel = (c: string) => SALES_CHANNELS.find(([v]) => v === c)?.[1] ?? c;

export const EVENT_LABEL: Record<string, string> = {
  submitted: "Solicitud enviada",
  updated: "Solicitud actualizada",
  resubmitted: "Correcciones enviadas",
  review_started: "Revisión iniciada",
  info_requested: "Se pidió información adicional",
  approved: "Solicitud aprobada",
  rejected: "Solicitud rechazada",
  withdrawn: "Solicitud retirada",
  license_activated: "Licencia activada",
  note: "Nota interna",
};

const channelValues = SALES_CHANNELS.map(([v]) => v) as [string, ...string[]];

/** Valida el formulario de solicitud (la base de datos vuelve a validar). */
export const applicationSchema = z.object({
  full_name: z.string().trim().min(2, "Indica tu nombre completo").max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,25}$/, "Indica un teléfono válido"),
  country: z.string().trim().min(2, "Indica tu país").max(60),
  city: z.string().trim().min(2, "Indica tu ciudad").max(80),
  business_name: z.string().trim().max(120).optional().default(""),
  experience: z.string().trim().min(10, "Describe tu experiencia comercial (mínimo 10 caracteres)").max(2000),
  sales_channels: z.array(z.enum(channelValues)).min(1, "Elige al menos un canal de venta").max(8),
  social_links: z.string().trim().max(500).optional().default(""),
  motivation: z.string().trim().max(2000).optional().default(""),
  preferred_plan_id: z.union([z.literal(""), z.string().uuid()]).optional().default(""),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

/** Convierte el FormData del formulario en el objeto que espera la validación. */
export function applicationFromForm(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  return applicationSchema.safeParse({ ...raw, sales_channels: formData.getAll("sales_channels") });
}

/** Texto público del precio de un plan: nunca se muestra un precio no confirmado. */
export function planPriceLabel(plan: { price: number | string | null; currency: string | null; status: string }) {
  if (plan.status !== "active" || plan.price == null || !plan.currency) return "Precio pendiente de confirmación";
  const amount = Number(plan.price);
  try {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: plan.currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount} ${plan.currency}`;
  }
}
