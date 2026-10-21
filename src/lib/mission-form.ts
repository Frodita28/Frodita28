import { z } from "zod";
import { METRICS, metricMethod } from "./missions";
import { zonedLocalToUtc } from "./time";

const optionalLocal = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));

export const missionSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/, "Código: 2–20 caracteres A-Z, 0-9, guion o guion bajo"),
    title: z.string().trim().min(3, "Título demasiado corto").max(120),
    description: z.string().trim().max(2000).default(""),
    category: z.string().trim().min(2, "Indica la categoría").max(40),
    frequency: z.enum(["daily", "weekly", "monthly"]),
    metric: z.enum(METRICS.map((m) => m.value) as [string, ...string[]]),
    metric_category: z.string().trim().optional().default(""),
    metric_min_units: z.string().optional().default(""),
    target_value: z.coerce.number().positive("El objetivo debe ser mayor que 0").max(1_000_000),
    target_unit: z.string().trim().min(1, "Indica la unidad del objetivo").max(40),
    xp_reward: z.coerce.number().int().min(1, "Los XP deben ser al menos 1").max(100_000),
    difficulty: z.enum(["baja", "media", "alta"]),
    evidence_instructions: z.string().trim().max(2000).default(""),
    start_at: optionalLocal,
    end_at: optionalLocal,
    timezone: z.string().trim().min(3).max(64),
    review_grace_days: z.coerce.number().int().min(0).max(30),
    territory_rules: z.string().trim().max(500).default(""),
    status: z.enum(["draft", "active", "inactive", "archived"]),
    inactive_reason: z.string().trim().max(500).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.metric === "verified_units_category" && !v.metric_category)
      ctx.addIssue({ code: "custom", message: "Elige la categoría de producto de la métrica", path: ["metric_category"] });
    if (v.metric === "categories_with_min_units" && !(Number(v.metric_min_units) > 0))
      ctx.addIssue({ code: "custom", message: "Indica las unidades mínimas por categoría", path: ["metric_min_units"] });
  });

/** Convierte el formulario en una fila de la tabla missions. Devuelve un mensaje de error o la fila. */
export function missionFromForm(formData: FormData, planIds: string[]) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = missionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message } as const;
  const v = parsed.data;
  const method = metricMethod(v.metric);

  const startAt = v.start_at ? zonedLocalToUtc(v.start_at, v.timezone) : null;
  const endAt = v.end_at ? zonedLocalToUtc(v.end_at, v.timezone) : null;
  if ((v.start_at && !startAt) || (v.end_at && !endAt)) return { ok: false, error: "Fechas no válidas" } as const;
  if (startAt && endAt && endAt <= startAt) return { ok: false, error: "La fecha de fin debe ser posterior al inicio" } as const;

  const selectedPlans = formData.getAll("applicable_license_plans").map(String).filter((id) => planIds.includes(id));
  const planTargets: Record<string, number> = {};
  for (const id of planIds) {
    const t = Number(formData.get(`plan_target_${id}`));
    if (formData.get(`plan_target_${id}`) && t > 0) planTargets[id] = t;
  }
  const territories = v.territory_rules
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const metricParams: Record<string, unknown> = {};
  if (v.metric === "verified_units_category") metricParams.category = v.metric_category;
  if (v.metric === "categories_with_min_units") metricParams.min_units = Number(v.metric_min_units);

  return {
    ok: true,
    row: {
      code: v.code,
      title: v.title,
      description: v.description,
      category: v.category,
      frequency: v.frequency,
      metric: v.metric,
      metric_params: metricParams,
      plan_targets: planTargets,
      target_value: v.target_value,
      target_unit: v.target_unit,
      xp_reward: v.xp_reward,
      difficulty: v.difficulty,
      validation_method: method,
      evidence_required: method === "manual",
      evidence_instructions: v.evidence_instructions,
      start_at: startAt?.toISOString() ?? null,
      end_at: endAt?.toISOString() ?? null,
      timezone: v.timezone,
      review_grace_days: v.review_grace_days,
      applicable_license_plans: selectedPlans.length ? selectedPlans : null,
      territory_rules: territories.length ? territories : null,
      status: v.status,
      inactive_reason: v.inactive_reason || null,
    },
  } as const;
}
