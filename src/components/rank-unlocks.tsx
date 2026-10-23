import Link from "next/link";
import { TEXTOS_RANGOS, recompensasPorNivel } from "@/content/rangos";
import { formatXp, type Frequency } from "@/lib/missions";
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

export type MissionXp = { code: string; title: string; frequency: Frequency; xp_reward: number };

/** «Cómo ganar XP»: misiones disponibles para la tienda y los XP de cada una. */
export function HowToEarnXp({ missions }: { missions: MissionXp[] }) {
  const groups = (["daily", "weekly", "monthly"] as const)
    .map((f) => ({ f, items: missions.filter((m) => m.frequency === f) }))
    .filter((g) => g.items.length > 0);
  return (
    <section className="ui-card" aria-labelledby="ganar-xp-titulo">
      <SectionHeader
        title={TEXTOS_RANGOS.comoGanarTitulo}
        id="ganar-xp-titulo"
        aside={<Link href="/panel/misiones" className="ui-link text-[13px]">Ir a misiones</Link>}
      >
        {TEXTOS_RANGOS.comoGanarAyuda}
      </SectionHeader>
      {groups.length === 0 ? (
        <p className="text-fg-2">{TEXTOS_RANGOS.sinMisiones}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.f}>
              <p className="ui-label mb-2">{TEXTOS_RANGOS.frecuencias[g.f]}</p>
              <ul className="divide-y divide-line rounded-ui border border-line">
                {g.items.map((m) => (
                  <li key={m.code} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="min-w-0 truncate text-[15px]">{m.title}</span>
                    <span className="ui-num shrink-0 text-accent">+{formatXp(m.xp_reward)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
