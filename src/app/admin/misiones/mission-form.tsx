import { METRICS } from "@/lib/missions";
import { DEFAULT_TZ, utcToZonedLocal } from "@/lib/time";
import type { MissionRow } from "@/lib/types";
import { saveMission } from "./actions";

type Plan = { id: string; name: string; is_demo: boolean };
type Category = { slug: string; name: string };

export function MissionForm({ mission, plans, categories }: { mission?: MissionRow; plans: Plan[]; categories: Category[] }) {
  const m = mission;
  const tz = m?.timezone ?? DEFAULT_TZ;
  return (
    <form action={saveMission} className="space-y-6">
      {m && <input type="hidden" name="id" value={m.id} />}

      <fieldset className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="eyebrow px-1">Identificación</legend>
        <Field label="Código" name="code" defaultValue={m?.code} required placeholder="S11" />
        <Field label="Título" name="title" defaultValue={m?.title} required className="sm:col-span-2" />
        <Field label="Categoría" name="category" defaultValue={m?.category} required placeholder="Ventas" />
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="description">Descripción</label>
          <textarea className="input min-h-20" id="description" name="description" defaultValue={m?.description} maxLength={2000} />
        </div>
      </fieldset>

      <fieldset className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="eyebrow px-1">Objetivo y recompensa</legend>
        <Select label="Periodicidad" name="frequency" defaultValue={m?.frequency ?? "daily"} options={[["daily", "Diaria"], ["weekly", "Semanal"], ["monthly", "Mensual"]]} />
        <div className="sm:col-span-2 lg:col-span-3">
          <Select label="Cómo se mide (y se valida)" name="metric" defaultValue={m?.metric ?? "verified_sales_count"}
            options={METRICS.map((x) => [x.value, `${x.method === "auto" ? "Automática" : "Manual"} · ${x.label}`])} />
        </div>
        <Select label="Categoría de producto (si aplica)" name="metric_category" defaultValue={String(m?.metric_params?.category ?? "")}
          options={[["", "—"], ...categories.map((c) => [c.slug, c.name] as [string, string])]} />
        <Field label="Unidades mínimas por categoría (si aplica)" name="metric_min_units" type="number" defaultValue={m?.metric_params?.min_units as number | undefined} />
        <Field label="Objetivo" name="target_value" type="number" step="0.01" defaultValue={m?.target_value} required />
        <Field label="Unidad" name="target_unit" defaultValue={m?.target_unit} required placeholder="ventas" />
        <Field label="XP" name="xp_reward" type="number" defaultValue={m?.xp_reward} required />
        <Select label="Dificultad" name="difficulty" defaultValue={m?.difficulty ?? "media"} options={[["baja", "Baja"], ["media", "Media"], ["alta", "Alta"]]} />
        <div className="sm:col-span-2">
          <label className="label" htmlFor="evidence_instructions">Evidencia necesaria / instrucciones de validación</label>
          <textarea className="input min-h-20" id="evidence_instructions" name="evidence_instructions" defaultValue={m?.evidence_instructions} maxLength={2000} />
          <p className="mt-1 text-xs text-parchment">Las métricas manuales exigen evidencia y revisión; las automáticas usan ventas verificadas.</p>
        </div>
      </fieldset>

      <fieldset className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="eyebrow px-1">Vigencia</legend>
        <Field label="Inicio (opcional)" name="start_at" type="datetime-local" defaultValue={m?.start_at ? utcToZonedLocal(new Date(m.start_at), tz) : ""} />
        <Field label="Fin (opcional)" name="end_at" type="datetime-local" defaultValue={m?.end_at ? utcToZonedLocal(new Date(m.end_at), tz) : ""} />
        <Field label="Zona horaria de la campaña" name="timezone" defaultValue={tz} required />
        <Field label="Días para revisar tras el cierre" name="review_grace_days" type="number" defaultValue={m?.review_grace_days ?? 3} required />
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="eyebrow px-1">A quién aplica</legend>
        <p className="text-xs text-parchment">Sin planes marcados, aplica a todos. El objetivo por plan permite adaptar la meta al tipo de licencia o al inventario.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className="rounded-lg border border-ash p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="applicable_license_plans" value={p.id} defaultChecked={m?.applicable_license_plans?.includes(p.id)} />
                {p.name} {p.is_demo && <span className="text-xs text-warn">(provisional)</span>}
              </label>
              <input className="input mt-2" name={`plan_target_${p.id}`} type="number" step="0.01" min={0} placeholder="Objetivo propio (opcional)"
                defaultValue={m?.plan_targets?.[p.id] ?? ""} aria-label={`Objetivo para ${p.name}`} />
            </div>
          ))}
        </div>
        <Field label="Territorios (separados por coma; vacío = todos)" name="territory_rules" defaultValue={m?.territory_rules?.join(", ") ?? ""} />
      </fieldset>

      <fieldset className="card grid gap-4 sm:grid-cols-3">
        <legend className="eyebrow px-1">Estado</legend>
        <Select label="Estado" name="status" defaultValue={m?.status ?? "draft"} options={[["draft", "Borrador"], ["active", "Activa"], ["inactive", "Inactiva"], ["archived", "Archivada"]]} />
        <div className="sm:col-span-2">
          <Field label="Motivo si está inactiva" name="inactive_reason" defaultValue={m?.inactive_reason ?? ""} />
        </div>
      </fieldset>

      <button className="btn-bronze">{m ? "Guardar cambios" : "Crear misión"}</button>
    </form>
  );
}

function Field({ label, name, className = "", ...rest }: { label: string; name: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} {...rest} defaultValue={rest.defaultValue ?? ""} />
    </div>
  );
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: [string, string][]; defaultValue?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="input" id={name} name={name} defaultValue={defaultValue}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
