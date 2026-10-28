import { ESTADO_LICENCIA, ESTADO_PLAN, TEXTOS_LICENCIA_TIENDA as T } from "@/content/licencia-tienda";
import { vigencia } from "@/lib/licencia";
import { formatDay } from "@/lib/missions";
import { Icon, type IconName } from "./icons";
import { Badge, SectionHeader } from "./ui";

export type LicenseCardData = {
  status: string;
  territory: string | null;
  starts_at: string | null;
  ends_at: string | null;
  contract_ref: string | null;
  plan: { name: string; status: string; is_demo: boolean } | null;
};

const DOT = { success: "bg-success", accent: "bg-accent", alert: "bg-brand-red", neutral: "bg-fg-3" } as const;

/** Tarjeta tipo credencial con los datos de la licencia de la tienda (solo lectura). */
export function LicenseCard({ license, today }: { license: LicenseCardData | null; today: string }) {
  if (!license) {
    return (
      <section className="ui-card">
        <SectionHeader title={T.titulo} />
        <p className="text-fg-2">{T.sinLicencia}</p>
      </section>
    );
  }
  const estado = ESTADO_LICENCIA[license.status] ?? { texto: license.status, tono: "neutral" as const };
  const plan = license.plan;
  const v = vigencia(license.starts_at, license.ends_at, today, T.avisoDias);

  return (
    <section aria-labelledby="licencia-titulo">
      <SectionHeader title={T.titulo} id="licencia-titulo" />
      <article className="ui-card overflow-hidden p-0! sm:p-0!">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-4 sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-accent font-title text-2xl font-bold text-accent" aria-hidden>
              {T.sello}
            </span>
            <div className="min-w-0">
              <p className="ui-label">{T.etiqueta}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-title text-[32px] leading-none font-bold tracking-[0.02em] uppercase sm:text-[40px]">{plan?.name ?? T.sinPlan}</span>
                {plan?.is_demo && <Badge tone="accent">{T.provisional}</Badge>}
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-[13px] font-semibold tracking-[0.04em] uppercase">
            <span className={`h-2.5 w-2.5 rounded-full ${DOT[estado.tono]}`} aria-hidden />
            <span className="sr-only">Estado: </span>
            {estado.texto}
          </span>
        </header>

        <dl className="grid gap-px bg-line sm:grid-cols-2">
          <Block icon="map" label={T.territorio}>
            {license.territory ? license.territory : <span className="text-fg-2">{T.sinTerritorio}</span>}
          </Block>

          <Block icon="calendar" label={T.vigencia}>
            <p>{license.starts_at ? `${T.desde} ${formatDay(license.starts_at)}` : <span className="text-fg-2">{T.sinInicio}</span>}</p>
            {v && license.ends_at ? (
              <div className="mt-2 space-y-2">
                <div
                  className="h-1.5 overflow-hidden rounded-ui bg-surface-2"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(v.transcurrido * 100)}
                  aria-label="Vigencia transcurrida"
                >
                  <div className="h-full rounded-ui bg-accent" style={{ width: `${v.transcurrido * 100}%` }} />
                </div>
                <p className={`flex items-center gap-2 text-[13px] ${v.porVencer ? "font-medium text-fg" : "text-fg-2"}`}>
                  {v.porVencer && <Icon name="alert" className="h-4 w-4 text-accent" />}
                  {v.diasRestantes === 1 ? "1 día restante" : `${v.diasRestantes} días restantes`} · hasta el {formatDay(license.ends_at)}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-fg-2">{T.sinCierre}</p>
            )}
          </Block>

          <Block icon="document" label={T.contrato}>
            {license.contract_ref ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="success"><Icon name="check" className="h-3.5 w-3.5" /> {T.contratoRegistrado}</Badge>
                <span className="text-[13px] text-fg-2">{license.contract_ref}</span>
              </span>
            ) : (
              <Badge tone="accent"><Icon name="clock" className="h-3.5 w-3.5" /> {T.contratoPendiente}</Badge>
            )}
          </Block>

          <Block icon="shield" label={T.plan}>
            <p>{plan?.name ?? <span className="text-fg-2">{T.sinPlan}</span>}</p>
            {plan && <p className="mt-1 text-[13px] text-fg-2">{ESTADO_PLAN[plan.status] ?? plan.status}{plan.is_demo ? " · provisional" : ""}</p>}
          </Block>
        </dl>

      </article>
    </section>
  );
}

function Block({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-surface p-4 sm:p-6">
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0 text-fg-2" />
      <div className="min-w-0 flex-1">
        <dt className="ui-label mb-2">{label}</dt>
        <dd className="text-[15px]">{children}</dd>
      </div>
    </div>
  );
}
