import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { formatGn, formatNum, formatUsd } from "@/lib/gn";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { returnSale, reviewSale } from "../actions";
import { nombre, senal, type ProfileRef } from "../shared";

export const metadata = { title: "Ventas en revisión · Admin" };

type Hold = {
  sale_id: string;
  licensee_id: string;
  status: string;
  hold_until: string;
  garments: number;
  units_with_gn: number;
  pvp_total: number;
  gn_amount: number;
  flags: unknown[];
  reviewed: boolean;
  released_at: string | null;
  created_at: string;
  profiles: ProfileRef;
  sales: { reference: string; sold_at: string } | null;
};

const VISTAS = { revision: "En revisión", espera: "En espera", liberadas: "Liberadas (devoluciones)" } as const;
const SELECT = "sale_id, licensee_id, status, hold_until, garments, units_with_gn, pvp_total, gn_amount, flags, reviewed, released_at, created_at, profiles(full_name, public_alias), sales(reference, sold_at)";

export default async function VentasGnAdmin({ searchParams }: PageProps<"/admin/recompensas/ventas">) {
  const sp = await searchParams;
  const vista = (typeof sp.ver === "string" && sp.ver in VISTAS ? sp.ver : "revision") as keyof typeof VISTAS;
  const supabase = await createClient();
  const status = vista === "revision" ? "en_revision" : vista === "espera" ? "en_espera" : "liberada";
  const { data } = await supabase
    .from("gn_sale_holds")
    .select(SELECT)
    .eq("status", status)
    .order(vista === "liberadas" ? "released_at" : "created_at", { ascending: vista !== "liberadas" })
    .limit(200);
  const holds = (data ?? []) as unknown as Hold[];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Recompensas GN" title="Ventas y GN en espera">
        Cada venta verificada genera GN pendientes que se liberan tras la espera. Las ventas con señales de fraude pasan a
        revisión y no se liberan hasta que las apruebes. Dentro de la espera, una venta anulada revierte sus GN sola; después,
        solo el administrador registra la devolución.
      </PageTitle>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Vistas de ventas">
        {Object.entries(VISTAS).map(([k, l]) => (
          <Link key={k} href={`/admin/recompensas/ventas?ver=${k}`} aria-current={k === vista ? "page" : undefined} className={`btn-ghost min-h-11 ${k === vista ? "border-bronze text-ivory" : ""}`}>
            {l}
          </Link>
        ))}
      </nav>

      {holds.length === 0 && <p className="card text-sm text-parchment">No hay ventas en esta vista.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {holds.map((h) => (
          <article key={h.sale_id} className="card space-y-3 text-sm">
            <header>
              <p className="text-xs text-parchment">{nombre(h.profiles, h.licensee_id)} · Ticket {h.sales?.reference ?? h.sale_id.slice(0, 8)}</p>
              <h2 className="font-semibold">
                {formatGn(h.gn_amount)} · {formatNum(h.garments)} prendas · PVP {formatUsd(Number(h.pvp_total))}
              </h2>
              <p className="text-xs text-parchment">
                Vendida {h.sales ? formatDateTime(h.sales.sold_at) : "—"} ·{" "}
                {h.status === "liberada" && h.released_at ? `Liberada ${formatDateTime(h.released_at)}` : `Se libera ${formatDateTime(h.hold_until)}`}
                {h.units_with_gn < h.garments ? ` · ${formatNum(h.units_with_gn)} con GN (tope diario)` : ""}
              </p>
            </header>
            {h.flags.length > 0 && (
              <ul className="flex flex-wrap gap-1" aria-label="Señales">
                {h.flags.map((f, i) => <li key={i} className="rounded-full border border-bad/60 px-2 py-0.5 text-xs text-bad">{senal(f)}</li>)}
              </ul>
            )}
            {h.reviewed && <p className="text-xs text-ok">Revisada</p>}

            {(h.status === "en_revision" || h.status === "en_espera") && (
              <form action={reviewSale} className="space-y-2">
                <input type="hidden" name="sale_id" value={h.sale_id} />
                <div>
                  <label className="label" htmlFor={`n-${h.sale_id}`}>Nota (obligatoria para anular)</label>
                  <input className="input text-base" id={`n-${h.sale_id}`} name="note" maxLength={500} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {h.status === "en_revision" && <button name="decision" value="aprobar" className="btn-bronze min-h-11">Aprobar</button>}
                  <button name="decision" value="anular" className="btn-danger min-h-11">Anular venta y GN</button>
                </div>
              </form>
            )}

            {h.status === "liberada" && (
              <form action={returnSale} className="space-y-2">
                <input type="hidden" name="sale_id" value={h.sale_id} />
                <div>
                  <label className="label" htmlFor={`r-${h.sale_id}`}>Motivo de la devolución</label>
                  <input className="input text-base" id={`r-${h.sale_id}`} name="reason" required minLength={5} maxLength={500} />
                </div>
                <button className="btn-danger min-h-11">Registrar devolución</button>
                <p className="text-xs text-parchment">Descuenta los GN; si ya se gastaron, la diferencia queda como saldo por cubrir.</p>
              </form>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
