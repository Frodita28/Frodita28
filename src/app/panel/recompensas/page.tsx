import { Banner, Bar, ComingSoon } from "@/components/club";
import { requireUser } from "@/lib/auth";
import { formatDay, formatXp } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Recompensas" };

type Reward = {
  id: string;
  name: string;
  description: string;
  requirements: string;
  points_required: number;
  stock: number | null;
  availability_start: string | null;
  availability_end: string | null;
  terms: string;
};

export default async function RewardsPage() {
  const user = await requireUser("/panel/recompensas");
  const supabase = await createClient();
  // La política de la tabla solo entrega recompensas aprobadas (status = 'active').
  const now = new Date().toISOString();
  const [{ data }, { data: balance }] = await Promise.all([
    supabase
      .from("rewards")
      .select("id, name, description, requirements, points_required, stock, availability_start, availability_end, terms")
      .eq("status", "active")
      .or(`availability_end.is.null,availability_end.gte.${now}`)
      .order("points_required"),
    supabase.from("user_xp_balances").select("total_xp").eq("user_id", user.id).maybeSingle(),
  ]);
  const rewards = ((data ?? []) as Reward[]).filter((r) => !r.availability_start || new Date(r.availability_start) <= new Date(now));
  const xp = Number(balance?.total_xp ?? 0);

  return (
    <>
      <Banner title="Recompensas y experiencias" accent="blood">
        Premios que Gallo Negro aprueba para su red de tiendas. Tu progreso se mide con tus XP actuales ({formatXp(xp)}).
        Los XP no representan dinero ni garantizan beneficios económicos.
      </Banner>

      {rewards.length === 0 ? (
        <ComingSoon title="Catálogo de recompensas" accent="gold">
          Gallo Negro todavía no ha publicado recompensas. Aparecerán aquí, con sus requisitos reales, cuando se aprueben.
        </ComingSoon>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {rewards.map((r, i) => {
            const missing = Math.max(r.points_required - xp, 0);
            const accent = i === 0 ? "gold" : "blood";
            return (
              <article key={r.id} className={`slab flex flex-col gap-3 ${i === 0 ? "border-2 border-gold" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-display text-xl uppercase leading-tight sm:text-2xl">{r.name}</h2>
                  {r.stock !== null && <span className="tag bg-blood text-ivory">{r.stock} disponibles</span>}
                </div>
                {r.description && <p className="text-sm text-linen">{r.description}</p>}
                {r.requirements && (
                  <p className="text-xs text-parchment"><span className="font-bold text-linen">Requisitos: </span>{r.requirements}</p>
                )}
                <div className="mt-auto space-y-2">
                  <p className="flex justify-between text-xs font-bold">
                    <span>Progreso del requisito</span>
                    <span className={accent === "gold" ? "text-gold" : "text-blood"}>
                      {new Intl.NumberFormat("es-VE").format(Math.min(xp, r.points_required))} / {formatXp(r.points_required)}
                    </span>
                  </p>
                  <Bar value={xp} target={r.points_required} accent={accent} label={`Progreso hacia ${r.name}`} />
                  <p className="text-right text-[11px] text-parchment">
                    {missing === 0 ? "¡Requisito de XP alcanzado!" : `Faltan ${formatXp(missing)} para desbloquear`}
                  </p>
                </div>
                {(r.availability_end || r.terms) && (
                  <details className="text-xs text-parchment">
                    <summary className="cursor-pointer font-bold text-linen">Condiciones</summary>
                    {r.availability_end && <p className="mt-1">Disponible hasta el {formatDay(r.availability_end.slice(0, 10))}.</p>}
                    {r.terms && <p className="mt-1 whitespace-pre-line">{r.terms}</p>}
                  </details>
                )}
                <button type="button" className="btn-slab w-full py-3" disabled>
                  Canje próximamente
                </button>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
