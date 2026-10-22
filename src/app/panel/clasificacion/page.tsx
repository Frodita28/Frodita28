import Link from "next/link";
import { Alert, EmptyState, PageBanner, Ranking } from "@/components/ui";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { parseBoard } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Clasificación" };

export default async function LeaderboardPage({ searchParams }: PageProps<"/panel/clasificacion">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 40);
  await requireUser("/panel/clasificacion");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("store_leaderboard", { p_limit: 100 });
  const board = parseBoard(data);
  const rows = q ? board.filter((r) => r.alias.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es"))) : board;
  const me = board.find((r) => r.isMe);

  return (
    <>
      <PageBanner
        title="Tabla de clasificación"
        aside={
          me && (
            <div className="ui-card-inset min-w-32 text-center">
              <p className="ui-label">Tu posición</p>
              <p className="ui-num mt-2 text-[40px] leading-none text-accent">#{me.place}</p>
            </div>
          )
        }
      >
        Tiendas con licencia activa ordenadas por XP. Solo se muestra el nombre visible de cada tienda y sus XP: las
        ventas y los datos de cada tienda son privados.
      </PageBanner>

      <section className="flex flex-col gap-4" aria-label="Clasificación">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-label">Vista:</span>
            <span className="ui-chip" aria-current="page">Individual</span>
            <span className="ui-chip cursor-not-allowed opacity-60" title="Los equipos aún no están definidos">
              Por squads · próximamente
            </span>
          </div>
          <form className="relative w-full sm:w-72" role="search">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-2" />
            <label htmlFor="q" className="sr-only">Buscar tienda</label>
            <input id="q" name="q" defaultValue={q} className="ui-input pl-9" placeholder="Buscar tienda…" />
          </form>
        </div>

        {error ? (
          <Alert>No se pudo cargar la clasificación.</Alert>
        ) : board.length === 0 ? (
          <EmptyState>Todavía no hay tiendas con licencia activa en la clasificación.</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>Ninguna tienda coincide con «{q}».</EmptyState>
        ) : (
          <Ranking rows={rows} />
        )}

        <p className="text-[13px] text-fg-2">
          Tu nombre visible se cambia en <Link href="/panel#datos-tienda" className="ui-link">Datos de tu tienda</Link>; sin él
          apareces como «Tienda Gallo Negro». Los XP no representan dinero ni garantizan beneficios económicos.
        </p>
      </section>
    </>
  );
}
