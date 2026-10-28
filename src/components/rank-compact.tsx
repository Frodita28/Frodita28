import Link from "next/link";
import { formatXp } from "@/lib/missions";
import { estadoRango } from "@/lib/rangos";
import { RankEmblem } from "./rangos";
import { ProgressBar } from "./ui";

/** Rango en una tarjeta compacta de Perfil: medallón pequeño, XP total y barra hacia el siguiente rango. */
export function RankCompact({ totalXp }: { totalXp: number }) {
  const { rango, siguiente, progreso, xpRestantes, maximoCompletado } = estadoRango(totalXp);
  return (
    <section className="ui-card flex flex-col gap-4" aria-labelledby="rango-titulo">
      <div className="flex items-center gap-3">
        <span data-gn-xp-destino>
          <RankEmblem rango={rango} className="h-12 w-12" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ui-label">Rango</p>
          <h2 id="rango-titulo" className="mt-1 truncate font-title text-lg leading-tight font-extrabold uppercase">{rango.nombre}</h2>
        </div>
        <p className="ui-num shrink-0 text-right text-[15px]">{formatXp(totalXp)}</p>
      </div>
      <ProgressBar value={Math.round(progreso * 100)} target={100} done={maximoCompletado} label={maximoCompletado ? "Rango máximo" : `Progreso hacia ${siguiente?.nombre ?? "el siguiente rango"}`} />
      <p className="text-[13px] text-fg-2">
        {maximoCompletado || !siguiente ? "Alcanzaste el rango máximo." : `Faltan ${formatXp(xpRestantes)} para ${siguiente.nombre}.`}{" "}
        <Link href="/panel/misiones" className="ui-link">Ganar XP</Link>
      </p>
    </section>
  );
}
