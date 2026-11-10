import Link from "next/link";
import { GnBalance, GnDisclaimer, noticeViews } from "@/components/gn";
import { GnNotices } from "@/components/gn-notices";
import { Icon } from "@/components/icons";
import { PageBanner } from "@/components/ui";
import { RANGOS } from "@/content/rangos";
import { TEXTOS_CLAN as T } from "@/content/recompensas";
import { requireUser } from "@/lib/auth";
import {
  getCatalog,
  getClanPaused,
  getCurrentEdition,
  getMyGoal,
  getMyLedger,
  getMyNotices,
  getMyRank,
  getMyRedemptions,
  getTerms,
  type LedgerEntry,
} from "@/lib/clan-server";
import { estadoPremio, formatGn, formatNum } from "@/lib/gn";
import { getGnConfig, getGnResumen, getRecompensasV3 } from "@/lib/gn-server";
import { formatDay, todayIn } from "@/lib/missions";
import { formatDateTime } from "@/lib/time";
import { ClanCatalog, type CatalogItem } from "./catalog";
import { TiendaClanLegacy } from "./legacy";
import { RedemptionList } from "./redemptions";

export const metadata = { title: "Tienda Clan" };

const SECCIONES = ["catalogo", "canjes", "movimientos"] as const;
type Seccion = (typeof SECCIONES)[number];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreRango = (nivel: number) => RANGOS.find((r) => r.nivel === nivel)?.nombre ?? `Rango ${nivel}`;

export default async function TiendaClanPage({ searchParams }: PageProps<"/panel/tienda-clan">) {
  const user = await requireUser("/panel/tienda-clan");
  if (!(await getRecompensasV3())) return <TiendaClanLegacy />;

  const sp = await searchParams;
  const seccion: Seccion = SECCIONES.includes(sp.seccion as Seccion) ? (sp.seccion as Seccion) : "catalogo";

  // El saldo se pide primero: el servidor libera lo que ya cumplió la espera.
  const resumen = await getGnResumen();
  const [cfg, rank, products, edition, goal, terms, paused, notices, redemptions, ledger] = await Promise.all([
    getGnConfig(),
    getMyRank(),
    getCatalog(),
    getCurrentEdition(),
    getMyGoal(user.id),
    getTerms(),
    getClanPaused(),
    getMyNotices(user.id),
    seccion === "canjes" || seccion === "catalogo" ? getMyRedemptions(user.id) : Promise.resolve([]),
    seccion === "movimientos" ? getMyLedger(user.id) : Promise.resolve([] as LedgerEntry[]),
  ]);
  const nivel = rank?.level ?? 1;
  const mes = edition ? Number(edition.month.slice(5, 7)) : Number(todayIn("America/Caracas").slice(5, 7));
  const unidad = cfg.gn_modo_venta === "por_prenda" ? "prendas" : "ventas";

  const usados = new Map<string, number>();
  for (const r of redemptions) if (!["rechazado", "cancelado"].includes(r.status)) usados.set(r.product_id, (usados.get(r.product_id) ?? 0) + 1);

  const items: CatalogItem[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    photo: p.photos[0] ?? null,
    tier: p.tier,
    minRank: p.min_rank,
    minRankName: nombreRango(p.min_rank),
    price: p.price_gn,
    permanent: p.is_permanent,
    until: p.available_until ? formatDay(todayIn("America/Caracas", new Date(p.available_until))) : null,
    needsAddress: p.needs_address,
    leadDays: p.lead_days,
    estado: estadoPremio(
      { precio: p.price_gn, rangoMinimo: p.min_rank, stock: p.stock, canjeados: usados.get(p.id) ?? 0, limite: p.limit_per_user },
      { nivel, disponible: resumen.debt > 0 ? 0 : resumen.available },
      cfg,
    ),
  }));

  return (
    <>
      <PageBanner title={T.titulo}>{T.bajada}</PageBanner>
      <div className="-mt-6 flex flex-col gap-6 sm:-mt-8">
        <GnDisclaimer />
        <GnBalance resumen={resumen} diasEspera={cfg.gn_dias_espera} />
        {paused && <p className="ui-card border-gold text-[15px]">{T.pausado}</p>}
        <GnNotices items={noticeViews(notices)} />

        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Secciones de Tienda Clan">
          {SECCIONES.map((s) => (
            <Link key={s} href={`/panel/tienda-clan?seccion=${s}`} className="ui-tab" aria-current={s === seccion ? "page" : undefined}>
              {T.secciones[s]}
            </Link>
          ))}
          <Link href="/panel/recompensas#como-funciona" className="ui-tab ml-auto">
            <Icon name="document" className="h-4 w-4" /> {T.comoFunciona}
          </Link>
        </nav>

        {seccion === "catalogo" && (
          <section aria-labelledby="edicion" className="flex flex-col gap-4">
            <h2 id="edicion" className="ui-title-section">
              {edition || items.length > 0 ? T.edicion(MESES[mes - 1]) : T.sinEdicion}
            </h2>
            <ClanCatalog
              items={items}
              available={resumen.available}
              goalId={goal}
              unidadVenta={unidad}
              paused={paused}
              blocked={resumen.debt > 0}
              terms={terms ? { version: terms.version, clauses: terms.clauses, isDraft: terms.is_draft, accepted: terms.accepted_at !== null } : null}
              defaultName={user.fullName ?? ""}
            />
          </section>
        )}

        {seccion === "canjes" && (
          <section aria-labelledby="mis-canjes" className="flex flex-col gap-4">
            <h2 id="mis-canjes" className="ui-title-section">{T.secciones.canjes}</h2>
            <RedemptionList
              items={redemptions.map((r) => ({
                id: r.id,
                name: r.product_name,
                price: r.price_gn,
                status: r.status,
                createdAt: formatDateTime(r.created_at),
                note: r.admin_note,
                substitute: r.substitute_note,
              }))}
            />
          </section>
        )}

        {seccion === "movimientos" && <Movimientos ledger={ledger} />}
      </div>
    </>
  );
}

function Movimientos({ ledger }: { ledger: LedgerEntry[] }) {
  if (ledger.length === 0) return <p className="ui-card text-fg-2">{T.sinMovimientos}</p>;
  const rows = conSaldo(ledger).reverse();
  return (
    <section aria-labelledby="movimientos" className="flex flex-col gap-4">
      <h2 id="movimientos" className="ui-title-section">{T.secciones.movimientos}</h2>
      <ul className="ui-card flex flex-col divide-y divide-line p-0 sm:p-0">
        {rows.map((r) => {
          const pend = r.d_available === 0 && r.d_pending !== 0;
          const cambio = r.d_available !== 0 ? r.d_available : r.d_pending;
          return (
            <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[15px] [overflow-wrap:anywhere]">{r.description}</p>
                <p className="text-[13px] text-fg-2">{formatDateTime(r.created_at)}</p>
              </div>
              <div className="shrink-0 text-right">
                {cambio !== 0 && (
                  <p className={`ui-num text-[15px] ${cambio > 0 ? "text-success" : "text-fg"}`}>
                    {cambio > 0 ? "+" : "−"}
                    {formatNum(Math.abs(cambio))}
                    {pend && <span className="ml-1 text-[12px] font-normal text-fg-2">{T.pendienteEtiqueta}</span>}
                  </p>
                )}
                <p className="ui-num text-[13px] text-fg-2">{formatGn(r.saldo)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Saldo disponible después de cada movimiento (del más antiguo al más nuevo). */
function conSaldo(ledger: LedgerEntry[]) {
  return ledger.reduce<(LedgerEntry & { saldo: number })[]>((acc, l) => {
    acc.push({ ...l, saldo: (acc.at(-1)?.saldo ?? 0) + l.d_available });
    return acc;
  }, []);
}
