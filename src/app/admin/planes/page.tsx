import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { PUBLIC_PLAN_COLUMNS, type PublicPlan } from "@/components/plan-card";
import { Pill } from "@/components/status-badge";
import { createClient } from "@/lib/supabase/server";
import { addBenefit, createPlan, savePlan, updateBenefit } from "./actions";

export const metadata = { title: "Planes · Admin" };

const PLAN_STATUS = [
  ["pending_confirmation", "Pendiente de confirmación"],
  ["active", "Disponible (publica el precio)"],
  ["inactive", "Inactivo (oculto)"],
] as const;

const BENEFIT_STATUS = [
  ["confirmed", "Confirmado"],
  ["contract_only", "Solo en determinados contratos"],
  ["pending_approval", "Pendiente de aprobación (no se publica)"],
] as const;

type Plan = PublicPlan & { sort_order: number };

export default async function AdminPlans({ searchParams }: PageProps<"/admin/planes">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("license_plans").select(`${PUBLIC_PLAN_COLUMNS}, sort_order`).order("sort_order");
  const plans = (data ?? []) as unknown as Plan[];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Oferta comercial" title="Planes de licencia">
        Todo lo que se guarde aquí aparece en la página pública. El precio solo se publica cuando el plan está
        &quot;Disponible&quot;; los beneficios pendientes de aprobación nunca se muestran. No publiques condiciones que
        Gallo Negro no haya confirmado por escrito.
      </PageTitle>

      <div className="space-y-6">
        {plans.map((p) => (
          <section key={p.id} id={`plan-${p.id}`} className="card scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg uppercase">{p.name}</h2>
              <span className="text-xs text-parchment">{p.code}</span>
              <Pill tone={p.status === "active" ? "ok" : p.status === "inactive" ? "neutral" : "warn"}>
                {PLAN_STATUS.find(([v]) => v === p.status)?.[1].split(" (")[0]}
              </Pill>
              {p.is_demo && <Pill tone="warn">Provisional</Pill>}
            </div>

            <form action={savePlan} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="id" value={p.id} />
              <Text name="name" label="Nombre" value={p.name} required />
              <div>
                <label className="label" htmlFor={`status-${p.id}`}>Estado</label>
                <select className="input" id={`status-${p.id}`} name="status" defaultValue={p.status}>
                  {PLAN_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <Text name="price" label="Precio" value={p.price} type="number" step="0.01" />
              <Text name="currency" label="Moneda" value={p.currency} placeholder="USD" />
              <Text name="duration_months" label="Duración (meses)" value={p.duration_months} type="number" />
              <Text name="units_included" label="Unidades incluidas" value={p.units_included} type="number" />
              <Text name="territory" label="Territorio" value={p.territory} />
              <Text name="sort_order" label="Orden" value={p.sort_order} type="number" />
              <Area name="description" label="Descripción" value={p.description} />
              <Area name="authorized_products" label="Productos autorizados" value={p.authorized_products} />
              <Area name="exclusivity_terms" label="Condiciones de exclusividad" value={p.exclusivity_terms} />
              <Area name="materials_included" label="Materiales y herramientas" value={p.materials_included} />
              <Area name="renewal_terms" label="Renovación" value={p.renewal_terms} />
              <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-4">
                <input type="checkbox" name="is_demo" value="true" defaultChecked={p.is_demo} className="accent-bronze" />
                Datos provisionales (desmárcalo cuando las condiciones estén confirmadas)
              </label>
              <button className="btn-bronze sm:col-span-2 lg:col-span-4 lg:justify-self-start">Guardar plan</button>
            </form>

            <div className="mt-6 border-t border-ash pt-4">
              <h3 className="eyebrow mb-3">Beneficios</h3>
              <ul className="mb-3 space-y-2">
                {p.plan_benefits.length === 0 && <li className="text-sm text-parchment">Sin beneficios registrados.</li>}
                {[...p.plan_benefits].sort((a, b) => a.sort_order - b.sort_order).map((b) => (
                  <li key={b.id}>
                    <form action={updateBenefit} className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="hidden" name="id" value={b.id} />
                      <span className="min-w-0 flex-1">{b.description}</span>
                      <select className="input w-auto px-2 py-1 text-xs" name="status" defaultValue={b.status} aria-label="Clasificación">
                        {BENEFIT_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <button className="btn-ghost px-3 py-1 text-xs">Aplicar</button>
                      <button className="btn-danger px-3 py-1 text-xs" name="remove" value="true">Quitar</button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={addBenefit} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="plan_id" value={p.id} />
                <input className="input" name="description" required minLength={3} maxLength={300} placeholder="Nuevo beneficio" aria-label="Nuevo beneficio" />
                <select className="input sm:w-64" name="status" defaultValue="pending_approval" aria-label="Clasificación">
                  {BENEFIT_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button className="btn-ghost whitespace-nowrap">Añadir</button>
              </form>
            </div>
          </section>
        ))}
      </div>

      <section className="card mt-6 max-w-xl">
        <h2 className="eyebrow mb-3">Nuevo plan</h2>
        <form action={createPlan} className="grid gap-3 sm:grid-cols-3">
          <Text name="code" label="Código" value="" placeholder="PLAN_5" required />
          <div className="sm:col-span-2"><Text name="name" label="Nombre" value="" required /></div>
          <button className="btn-ghost sm:col-span-3 sm:justify-self-start">Crear como pendiente</button>
        </form>
      </section>
    </>
  );
}

function Text({ name, label, value, ...rest }: { name: string; label: string; value: string | number | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value">) {
  return (
    <div>
      <label className="label">
        {label}
        <input className="input mt-1 font-normal normal-case tracking-normal" name={name} defaultValue={value ?? ""} {...rest} />
      </label>
    </div>
  );
}

function Area({ name, label, value }: { name: string; label: string; value: string | null }) {
  return (
    <div className="sm:col-span-2">
      <label className="label">
        {label}
        <textarea className="input mt-1 min-h-16 font-normal normal-case tracking-normal" name={name} defaultValue={value ?? ""} />
      </label>
    </div>
  );
}
