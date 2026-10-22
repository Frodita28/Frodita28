import Link from "next/link";
import { Banner } from "@/components/club";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { parseBoard } from "@/lib/leaderboard";
import { formatXp } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Clasificación" };

const PLACE_COLOR = ["text-gold", "text-linen", "text-[#c98a4b]"];

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
      <Banner
        title="Tabla de clasificación"
        aside={
          me && (
            <div className="border border-ash bg-pit px-4 py-2 text-center">
              <p className="kicker">Tu posición</p>
              <p className="font-display text-2xl text-gold">#{me.place}</p>
            </div>
          )
        }
      >
        Tiendas con licencia activa ordenadas por XP. Solo se muestra el nombre visible de cada tienda y sus XP: las
        ventas y los datos de cada tienda son privados.
      </Banner>

      <div className="slab mb-4 flex flex-wrap items-center justify-between gap-3 py-3 sm:py-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <span className="text-parchment">Vista:</span>
          <span className="chip" aria-current="page">Individual</span>
          <span className="chip cursor-not-allowed opacity-60" title="Los equipos aún no están definidos">
            Por squads · próximamente
          </span>
        </div>
        <form className="flex w-full items-center gap-2 sm:w-72" role="search">
          <Icon name="search" className="h-4 w-4 shrink-0 text-parchment" />
          <label htmlFor="q" className="sr-only">Buscar tienda</label>
          <input id="q" name="q" defaultValue={q} className="input rounded-none py-1.5" placeholder="Buscar tienda…" />
        </form>
      </div>

      {error ? (
        <p className="slab text-sm text-bad">No se pudo cargar la clasificación.</p>
      ) : board.length === 0 ? (
        <p className="slab text-sm text-parchment">Todavía no hay tiendas con licencia activa en la clasificación.</p>
      ) : (
        <div className="overflow-x-auto border border-ash shadow-[4px_4px_0_0_#000]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slab font-condensed text-lg tracking-wide text-parchment uppercase">
              <tr>
                <th scope="col" className="w-16 px-4 py-3">Pos</th>
                <th scope="col" className="px-4 py-3">Tienda</th>
                <th scope="col" className="px-4 py-3 text-right">Puntos de XP</th>
              </tr>
            </thead>
            <tbody className="bg-pit">
              {rows.length === 0 && (
                <tr><td colSpan={3} className="border-t border-ash px-4 py-4 text-parchment">Ninguna tienda coincide con «{q}».</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={`${r.place}-${r.alias}-${i}`} className={`border-t border-ash ${r.isMe ? "bg-gold/10" : ""}`}>
                  <td className={`px-4 py-3 font-display text-xl ${PLACE_COLOR[r.place - 1] ?? "text-ivory"}`}>#{r.place}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-smoke bg-ash text-xs font-bold" aria-hidden>
                        {r.alias.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <p className={r.isMe ? "font-bold" : ""}>{r.alias}{r.isMe && " (Tú)"}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-parchment">Licenciatario verificado</p>
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right font-condensed text-2xl tracking-wide ${r.isMe ? "text-gold" : "text-gold-soft"}`}>
                    {formatXp(r.totalXp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-parchment">
        Tu nombre visible se cambia en <Link href="/panel#datos-tienda" className="text-gold">Datos de tu tienda</Link>; sin él
        apareces como «Tienda Gallo Negro». Los XP no representan dinero ni garantizan beneficios económicos.
      </p>
    </>
  );
}
