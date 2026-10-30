import Link from "next/link";
import { formatXp } from "@/lib/missions";
import { estadoRango } from "@/lib/rangos";
import { Icon } from "./icons";
import { RankEmblem } from "./rangos";
import { ProgressBar } from "./ui";

/**
 * Rango en una tarjeta compacta de Perfil: medallón pequeño, XP total y barra hacia el siguiente rango.
 * Toda la tarjeta lleva a la ruta de rangos; «Ganar XP» lleva a Misiones.
 */
export function RankCompact({ totalXp }: { totalXp: number }) {
  const { rango, siguiente, progreso, maximoCompletado } = estadoRango(totalXp);
  return (
    <section className="ui-card relative flex flex-col gap-4 transition-colors hover:border-gold/60" aria-labelledby="rango-titulo">
      <div className="flex items-center gap-3">
        <span data-gn-xp-destino>
          <RankEmblem rango={rango} className="h-12 w-12" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ui-label">Rango</p>
          <h2 id="rango-titulo" className="mt-1 truncate font-title text-lg leading-tight font-extrabold uppercase">
            {/* Enlace que cubre toda la tarjeta. */}
            <Link href="/panel/rangos" className="after:absolute after:inset-0 after:rounded-card">
              {rango.nombre}
            </Link>
          </h2>
        </div>
        <p className="ui-num shrink-0 text-right text-[15px]">{formatXp(totalXp)}</p>
        <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-gold" />
      </div>
      <ProgressBar
        value={Math.round(progreso * 100)}
        target={100}
        done={maximoCompletado}
        label={maximoCompletado ? "Rango máximo" : `Progreso hacia ${siguiente?.nombre ?? "el siguiente rango"}`}
      />
      <Link href="/panel/misiones" className="ui-link relative z-10 inline-flex min-h-11 items-center self-start">Ganar XP</Link>
    </section>
  );
}
