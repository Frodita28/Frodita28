import Link from "next/link";
import { Alert, EmptyState, PageBanner } from "@/components/ui";
import { Flash } from "@/components/flash";
import { Icon } from "@/components/icons";
import { TEXTOS_CLASIFICACION as T, TEXTOS_RANGOS } from "@/content/rangos";
import { requireUser } from "@/lib/auth";
import { parseBoard, rivalidad } from "@/lib/leaderboard";
import { estadoRango, todosLosRangos } from "@/lib/rangos";
import { createClient } from "@/lib/supabase/server";
import { LeaderboardBoard, type BoardEntry } from "./board";
import { NameEditor } from "./name-editor";
import { SearchToggle } from "./search-toggle";

export const metadata = { title: "Clasificación" };

const fmt = (n: number) => new Intl.NumberFormat("es-VE").format(n);

export default async function LeaderboardPage({ searchParams }: PageProps<"/panel/clasificacion">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 40);
  const liga = typeof sp.liga === "string" && todosLosRangos().some((r) => r.slug === sp.liga) ? sp.liga : "";
  const requested = Number(typeof sp.top === "string" ? sp.top : T.topInicial);
  const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : T.topInicial, T.topInicial), T.topMaximo);
  const user = await requireUser("/panel/clasificacion");
  const supabase = await createClient();
  // Top N + la posición de la tienda; el orden y el desempate los decide la base (rank() por XP).
  const { data, error } = await supabase.rpc("store_leaderboard", { p_limit: limit });
  const board = parseBoard(data);
  const me = board.find((r) => r.isMe);
  const rival = rivalidad(board);
  // La base devuelve como mucho `limit` tiendas más la propia: si llegan tantas, puede haber más.
  const truncated = board.filter((r) => r.place <= limit).length >= limit;
  const canShowMore = truncated && limit < T.topMaximo;

  const entries: BoardEntry[] = board.map((r) => {
    const e = estadoRango(r.totalXp);
    return {
      place: r.place,
      alias: r.alias || T.nombrePorDefecto,
      totalXp: r.totalXp,
      isMe: r.isMe,
      nivel: e.rango.nivel,
      slug: e.rango.slug,
      rangoNombre: e.rango.nombre,
      progreso: e.progreso,
      siguiente: e.siguiente?.nombre ?? null,
      maximoCompletado: e.maximoCompletado,
    };
  });
  const filtered = Boolean(q || liga);
  const rows = entries.filter(
    (r) => (!q || r.alias.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es"))) && (!liga || r.slug === liga),
  );

  const href = (params: { q?: string; liga?: string; top?: number }) => {
    const u = new URLSearchParams();
    const nq = params.q ?? q;
    const nl = params.liga ?? liga;
    const nt = params.top ?? (limit !== T.topInicial ? limit : undefined);
    if (nq) u.set("q", nq);
    if (nl) u.set("liga", nl);
    if (nt) u.set("top", String(nt));
    const s = u.toString();
    return `/panel/clasificacion${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <Flash ok={sp.ok} error={sp.error} variant="panel" />
        <PageBanner
          title={T.titulo}
          aside={
            <div className={`ui-card-inset min-w-36 text-center ${me ? "border-accent!" : ""}`}>
              <p className="ui-label">Tu posición</p>
              <p className="ui-num mt-2 text-[48px] leading-none text-accent">{me ? `#${me.place}` : "—"}</p>
              <p className="mt-2 text-[13px] text-fg-2">{!me ? "Sin licencia activa" : truncated ? `Top ${fmt(limit)} a la vista` : `de ${fmt(board.length)} ${board.length === 1 ? "tienda" : "tiendas"}`}</p>
            </div>
          }
        >
          {T.subtitulo} {T.privacidad}
        </PageBanner>
      </div>

      <section className="flex flex-col gap-4" aria-label="Clasificación">
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-4 lg:justify-between">
          <div className="gn-snap-x -ml-4 min-w-0 flex-1 overflow-x-auto pl-4 md:mx-0 md:px-0">
            <ul className="flex items-center gap-2 pb-1">
              <li className="ui-label shrink-0">Vista:</li>
              <li><span className="ui-chip" aria-current="page">Individual</span></li>
              <li><span className="ui-chip cursor-not-allowed opacity-60" aria-disabled="true">Por squads · próximamente</span></li>
              <li className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
              <li className="ui-label shrink-0">Período:</li>
              <li><span className="ui-chip" aria-current="page">Total</span></li>
              <li className="pr-4 md:pr-0"><span className="ui-chip cursor-not-allowed opacity-60" aria-disabled="true">Este mes · próximamente</span></li>
            </ul>
          </div>
          <SearchToggle q={q} liga={liga} top={limit !== T.topInicial ? limit : null} />
        </div>

        <nav className="gn-snap-x -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Ligas por rango">
          <ul className="flex gap-2 pb-1">
            <li>
              <Link href={href({ liga: "" })} className="ui-chip" aria-current={!liga ? "page" : undefined}>Todos</Link>
            </li>
            {todosLosRangos().map((r) => (
              <li key={r.slug}>
                <Link href={href({ liga: r.slug })} className="ui-chip" aria-current={liga === r.slug ? "page" : undefined}>
                  {r.nombre}
                  <span className="ui-num font-medium">({entries.filter((e) => e.slug === r.slug).length})</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          {me && rival && (
            <div className="ui-card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-accent!">
              <div className="min-w-0">
                <p className="ui-label">{rival.tipo === "rival" ? T.rivalTitulo : T.liderTitulo}</p>
                <p className="mt-2 text-[17px]">
                  {rival.tipo === "rival" ? (
                    <>
                      Estás a <span className="ui-num text-accent">{fmt(rival.gap)} XP</span> de superar a{" "}
                      <span className="font-semibold">{rival.alias}</span>.
                    </>
                  ) : rival.tipo === "lider" ? (
                    <>
                      Lideras la tabla por <span className="ui-num text-accent">{fmt(rival.ventaja)} XP</span>.
                    </>
                  ) : (
                    T.primeraTienda
                  )}
                </p>
              </div>
              <Link href="/panel/misiones" className="ui-btn-secondary shrink-0">
                <Icon name="flag" className="h-4 w-4" /> Sumar XP
              </Link>
            </div>
          )}
          <Link
            href="/panel/recompensas"
            className={`ui-card flex items-center gap-3 transition-colors duration-150 hover:bg-surface-2 ${me && rival ? "" : "md:col-span-2"}`}
          >
            <Icon name="gift" className="h-5 w-5 shrink-0 text-fg-2" />
            <span className="min-w-0 flex-1 text-[15px]">{T.reconocimientos}</span>
            <Icon name="chevronDown" className="h-4 w-4 shrink-0 -rotate-90 text-fg-2" />
          </Link>
        </div>

        {error ? (
          <Alert>No se pudo cargar la clasificación.</Alert>
        ) : board.length === 0 ? (
          <EmptyState>Todavía no hay tiendas con licencia activa en la clasificación. Cuando se activen, aparecerán aquí por XP.</EmptyState>
        ) : filtered && rows.length === 0 ? (
          <EmptyState>
            {q ? `Ninguna tienda coincide con «${q}»` : "Ninguna tienda está en esta liga todavía"}
            {q && liga ? " en esta liga" : ""}. <Link href={href({ q: "", liga: "" })} className="ui-link">Ver todas</Link>
          </EmptyState>
        ) : (
          <LeaderboardBoard entries={filtered ? rows : entries} filtered={filtered} />
        )}

        {canShowMore && (
          <Link href={href({ top: Math.min(limit * 2, T.topMaximo) })} className="ui-btn-secondary self-center" scroll={false}>
            Ver más
          </Link>
        )}

        <NameEditor alias={user.publicAlias} />

        <p className="text-[13px] text-fg-2">{TEXTOS_RANGOS.avisoXp}</p>
      </section>
    </>
  );
}
