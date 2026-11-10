import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { formatGn, formatNum, formatUsd } from "@/lib/gn";
import { getRecompensasV3 } from "@/lib/gn-server";
import { todayIn } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Recompensas GN · Admin" };

type Dashboard = {
  month: string;
  gn_emitted: number;
  gn_redeemed: number;
  gn_expired: number;
  gn_pending: number;
  gn_available: number;
  gn_debt: number;
  cost_delivered_usd: number;
  cost_month_usd: number;
  cap_usd: number | null;
  paused: boolean;
  verified_sales_usd: number;
  garments: number;
  cost_pct: number;
  target_pct: number;
  cost_per_garment_usd: number;
  profit_before_usd: number;
  profit_after_usd: number;
  gn_internal_usd: number;
  pending_redemptions: number;
  pending_validations: number;
  sales_in_review: number;
  alerts: { kind: string; text: string }[];
};

export default async function RecompensasResumen({ searchParams }: PageProps<"/admin/recompensas">) {
  const sp = await searchParams;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : todayIn("America/Caracas").slice(0, 7);
  const supabase = await createClient();
  const [{ data, error }, v3] = await Promise.all([supabase.rpc("admin_gn_dashboard", { p_month: `${mes}-01` }), getRecompensasV3()]);
  const d = data as Dashboard | null;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error ?? (error ? error.message : undefined)} />
      <PageTitle eyebrow="Recompensas GN" title="Resumen del programa">
        Cifras del mes en GN y en costo de premios. Los GN son puntos del club, sin valor fuera de Tienda Clan; el valor interno
        en USD solo sirve para controlar el costo.
      </PageTitle>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="mes">Mes</label>
          <input className="input" id="mes" name="mes" type="month" defaultValue={mes} />
        </div>
        <button className="btn-ghost min-h-11">Ver</button>
        <p className="text-sm text-parchment">
          Programa para licenciatarios: <strong className="text-ivory">{v3 ? "visible para ti (admin)" : "apagado"}</strong> ·{" "}
          <Link className="underline" href="/admin/recompensas/configuracion#recompensas_v3_activa">cambiar</Link>
        </p>
      </form>

      {d && (
        <>
          {d.alerts.length > 0 && (
            <div className="mb-6 space-y-2">
              {d.alerts.map((a) => (
                <p key={a.kind} role="alert" className="card border-bad/60 text-sm">{a.text}</p>
              ))}
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Por atender: canjes" value={formatNum(d.pending_redemptions)} href="/admin/recompensas/canjes" />
            <Tile label="Ventas en revisión" value={formatNum(d.sales_in_review)} href="/admin/recompensas/ventas" />
            <Tile label="Validaciones pendientes" value={formatNum(d.pending_validations)} href="/admin/recompensas/validaciones" />
            <Tile label="Catálogo" value={d.paused ? "En pausa" : "Abierto"} href="/admin/recompensas/catalogo" />
          </div>

          <h2 className="eyebrow mb-2">GN del mes</h2>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Emitidos" value={formatGn(d.gn_emitted)} />
            <Tile label="Canjeados" value={formatGn(d.gn_redeemed)} />
            <Tile label="Vencidos" value={formatGn(d.gn_expired)} />
            <Tile label="En espera (todos)" value={formatGn(d.gn_pending)} />
            <Tile label="Saldo disponible (todos)" value={formatGn(d.gn_available)} />
            <Tile label="Saldo por cubrir (todos)" value={formatGn(d.gn_debt)} />
          </div>

          <h2 className="eyebrow mb-2">Costo de premios</h2>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Costo entregado" value={formatUsd(d.cost_delivered_usd)} />
            <Tile label="Costo comprometido del mes" value={formatUsd(d.cost_month_usd)} hint={d.cap_usd ? `Tope ${formatUsd(Number(d.cap_usd))}` : "Sin tope mensual"} />
            <Tile label="Ventas verificadas" value={formatUsd(d.verified_sales_usd)} hint={`${formatNum(d.garments)} prendas`} />
            <Tile label="Costo / ventas" value={`${formatNum(Number(d.cost_pct))} %`} hint={`Objetivo ${formatNum(Number(d.target_pct))} %`} />
            <Tile label="Costo de premios por prenda" value={formatUsd(d.cost_per_garment_usd)} />
            <Tile label="Utilidad por prenda (antes)" value={formatUsd(d.profit_before_usd)} />
            <Tile label="Utilidad por prenda (después)" value={formatUsd(Number(d.profit_after_usd))} />
            <Tile label="Valor interno de 1 GN" value={formatUsd(Number(d.gn_internal_usd))} hint="Solo para control de costo" />
          </div>
        </>
      )}
    </>
  );
}

function Tile({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="label">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ivory">{value}</p>
      {hint && <p className="mt-1 text-xs text-parchment">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card block min-w-0 hover:border-bronze">{body}</Link>
  ) : (
    <div className="card min-w-0">{body}</div>
  );
}
