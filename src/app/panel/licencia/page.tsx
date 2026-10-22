import Link from "next/link";
import { Accordion, Badge, PageBanner, SectionHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { licencia } from "@/content/licencia";
import { requireUser } from "@/lib/auth";
import { PlanSimulador } from "./plan-simulador";

export const metadata = { title: "Licencia" };

export default async function LicensePage() {
  await requireUser("/panel/licencia");
  // Los planes de la base (Plan 1-4) aún no tienen equivalencia confirmada con estos planes, así que no se preselecciona.
  const { encabezado, beneficios, reconocimiento, clausulas, salida, pie } = licencia;

  return (
    <>
      <div className="flex flex-col gap-4">
        <PageBanner title={encabezado.titulo}>{encabezado.subtitulo}</PageBanner>
        <div className="flex flex-wrap items-start gap-3 rounded-ui border border-line bg-surface p-4">
          <Icon name="document" className="mt-0.5 h-5 w-5 shrink-0 text-fg-2" />
          <p className="min-w-0 flex-1 text-fg-2">{licencia.aviso}</p>
          {licencia.esBorrador && (
            <span title={licencia.avisoBorrador}>
              <Badge tone="accent">{licencia.etiquetaBorrador}</Badge>
            </span>
          )}
        </div>
      </div>

      <PlanSimulador planInicial={licencia.selectorPlan.planInicial} />

      <section>
        <SectionHeader title={beneficios.titulo} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {beneficios.lista.map((b) => (
            <article key={b.titulo} className="ui-card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <Icon name={b.icono} className="h-6 w-6 shrink-0 text-fg-2" />
                <Badge>{b.aplicaA}</Badge>
              </div>
              <h3 className="ui-title-card">{b.titulo}</h3>
              <p className="text-fg-2">{b.descripcion}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title={reconocimiento.titulo} />
        <div className="ui-card">
          <ul className="space-y-3">
            {reconocimiento.reglas.map((r) => (
              <li key={r} className="flex gap-3">
                <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-fg-2" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-6">
            {reconocimiento.enlaces.map((l) => (
              <Link key={l.href} href={l.href} className="ui-btn-secondary">
                <Icon name={l.icono} className="h-4 w-4" />
                {l.texto}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title={clausulas.titulo} />
        <div className="space-y-2">
          {clausulas.lista.map((c, i) => (
            <Accordion key={c.titulo} index={i + 1} title={c.titulo}>
              <p className="text-fg-2">{c.texto}</p>
            </Accordion>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title={salida.titulo} />
        <div className="ui-card">
          <p className="font-medium">{salida.intro}</p>
          <ol className="mt-4 space-y-3">
            {salida.pasos.map((p, i) => (
              <li key={p} className="flex gap-3">
                <span className="ui-num w-6 shrink-0 text-fg-2">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-fg-2">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-line pt-4 text-[13px] text-fg-2">
        <p>
          {pie.version} {licencia.version} · {pie.vigenteDesde} {licencia.vigenteDesde}
        </p>
        <p className="mt-1">{pie.ley}</p>
      </footer>
    </>
  );
}
