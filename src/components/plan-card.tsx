import { planPriceLabel } from "@/lib/applications";
import { Pill } from "./status-badge";

export type PublicPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number | string | null;
  currency: string | null;
  duration_months: number | null;
  territory: string | null;
  units_included: number | null;
  authorized_products: string | null;
  exclusivity_terms: string | null;
  materials_included: string | null;
  renewal_terms: string | null;
  status: "pending_confirmation" | "active" | "inactive";
  is_demo: boolean;
  plan_benefits: { id: string; description: string; status: "confirmed" | "pending_approval" | "contract_only"; sort_order: number }[];
};

export const PUBLIC_PLAN_COLUMNS =
  "id, code, name, description, price, currency, duration_months, territory, units_included, authorized_products, exclusivity_terms, materials_included, renewal_terms, status, is_demo, plan_benefits(id, description, status, sort_order)";

/** Tarjeta pública de un plan. Solo muestra datos configurados; lo no confirmado se indica como pendiente. */
export function PlanCard({ plan }: { plan: PublicPlan }) {
  const confirmed = plan.status === "active";
  const benefits = [...plan.plan_benefits].filter((b) => b.status !== "pending_approval").sort((a, b) => a.sort_order - b.sort_order);
  const facts = [
    ["Duración", plan.duration_months ? `${plan.duration_months} ${plan.duration_months === 1 ? "mes" : "meses"}` : null],
    ["Territorio", plan.territory],
    ["Unidades incluidas", plan.units_included != null ? String(plan.units_included) : null],
    ["Productos autorizados", plan.authorized_products],
    ["Exclusividad", plan.exclusivity_terms],
    ["Materiales", plan.materials_included],
    ["Renovación", plan.renewal_terms],
  ].filter((f): f is [string, string] => Boolean(f[1]));

  return (
    <article className="card flex flex-col" data-plan={plan.code}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-xl uppercase">{plan.name}</h3>
        {confirmed ? <Pill tone="ok">Disponible</Pill> : <Pill tone="warn">Pendiente</Pill>}
      </div>
      <p className="mt-3 font-display text-lg text-bronze-soft">{planPriceLabel(plan)}</p>
      {plan.description && <p className="mt-2 text-sm text-linen">{plan.description}</p>}

      {facts.length > 0 && (
        <dl className="mt-4 space-y-2 text-sm">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="label">{k}</dt>
              <dd className="text-linen">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 border-t border-ash pt-4">
        <p className="label">Beneficios</p>
        {benefits.length === 0 ? (
          <p className="text-sm text-parchment">Se publicarán cuando Gallo Negro los confirme.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {benefits.map((b) => (
              <li key={b.id} className="flex gap-2">
                <span className="text-bronze" aria-hidden="true">—</span>
                <span>
                  {b.description}
                  {b.status === "contract_only" && <span className="ml-1 text-xs text-parchment">(según contrato)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
