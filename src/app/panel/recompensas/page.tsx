import { Accordion, Badge, ComingSoon, PageBanner, ProgressBar } from "@/components/ui";
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
      <PageBanner title="Recompensas y experiencias">
        Premios que Gallo Negro aprueba para su red de tiendas. Tu progreso se mide con tus XP actuales ({formatXp(xp)}).
        Los XP no representan dinero ni garantizan beneficios económicos.
      </PageBanner>

      {rewards.length === 0 ? (
        <ComingSoon title="Catálogo de recompensas">
          Gallo Negro todavía no ha publicado recompensas. Aparecerán aquí, con sus requisitos reales, cuando se aprueben.
        </ComingSoon>
      ) : (
        <section className="grid gap-4 md:grid-cols-2" aria-label="Recompensas">
          {rewards.map((r) => {
            const missing = Math.max(r.points_required - xp, 0);
            return (
              <article key={r.id} className="ui-card flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="ui-title-section">{r.name}</h2>
                  {r.stock !== null && <Badge>{r.stock} disponibles</Badge>}
                </div>
                {r.description && <p>{r.description}</p>}
                {r.requirements && (
                  <p className="text-fg-2"><span className="font-medium text-fg">Requisitos: </span>{r.requirements}</p>
                )}
                <div className="mt-auto space-y-2">
                  <p className="flex flex-wrap justify-between gap-2 text-[13px]">
                    <span className="ui-label">Progreso del requisito</span>
                    <span className="ui-num">
                      {new Intl.NumberFormat("es-VE").format(Math.min(xp, r.points_required))} / {formatXp(r.points_required)}
                    </span>
                  </p>
                  <ProgressBar value={xp} target={r.points_required} label={`Progreso hacia ${r.name}`} />
                  <p className={`text-right text-[13px] ${missing === 0 ? "font-medium text-success" : "text-fg-2"}`}>
                    {missing === 0 ? "¡Requisito de XP alcanzado!" : `Faltan ${formatXp(missing)} para desbloquear`}
                  </p>
                </div>
                {(r.availability_end || r.terms) && (
                  <Accordion title="Condiciones">
                    <div className="space-y-2 text-fg-2">
                      {r.availability_end && <p>Disponible hasta el {formatDay(r.availability_end.slice(0, 10))}.</p>}
                      {r.terms && <p className="whitespace-pre-line">{r.terms}</p>}
                    </div>
                  </Accordion>
                )}
                <button type="button" className="ui-btn-secondary w-full" disabled>
                  Canje próximamente
                </button>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
