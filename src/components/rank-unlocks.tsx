import Link from "next/link";
import { TEXTOS_RANGOS, recompensasPorNivel } from "@/content/rangos";
import { todosLosRangos } from "@/lib/rangos";
import { Icon } from "./icons";
import { RankAvatar } from "./rangos";
import { Badge, SectionHeader } from "./ui";

const fmt = (n: number) => new Intl.NumberFormat("es-VE").format(n);

/** «Liberado en tu rango»: cosmético y recompensa de cada rango, desbloqueados o bloqueados. */
export function RankUnlocks({ nivelActual }: { nivelActual: number }) {
  return (
    <section className="ui-card" aria-labelledby="liberado-titulo">
      <SectionHeader
        title={TEXTOS_RANGOS.liberadoTitulo}
        id="liberado-titulo"
        aside={<Link href="/panel/recompensas" className="ui-link text-[13px]">Ver recompensas</Link>}
      />
      <ul className="grid gap-2">
        {todosLosRangos().map((r) => {
          const unlocked = r.nivel <= nivelActual;
          const recompensa = recompensasPorNivel.find((x) => x.nivel === r.nivel);
          return (
            <li key={r.slug} className={`ui-card-inset flex items-center gap-4 ${unlocked ? "" : "opacity-80"}`}>
              {unlocked ? (
                <RankAvatar nivel={r.nivel} label={String(r.nivel)} />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-line text-fg-3" aria-hidden>
                  <Icon name="lock" className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-title text-lg leading-none font-bold tracking-[0.02em] uppercase">{r.nombre}</span>
                  {unlocked ? (
                    <Badge tone="success"><Icon name="check" className="h-3.5 w-3.5" /> Liberado</Badge>
                  ) : (
                    <Badge><Icon name="lock" className="h-3.5 w-3.5" /> Nivel {r.nivel} · {fmt(r.xpInicio)} XP</Badge>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-fg-2">
                  {r.cosmetico}
                  {recompensa && (recompensa.publicada ? ` · ${recompensa.titulo}` : ` · Recompensa: ${TEXTOS_RANGOS.proximamente.toLowerCase()}`)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
