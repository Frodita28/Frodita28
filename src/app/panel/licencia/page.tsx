import Link from "next/link";
import { Banner } from "@/components/club";
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
      <Banner title={encabezado.titulo} accent="blood">
        {encabezado.subtitulo}
      </Banner>

      <div className="mb-5 flex flex-wrap items-start gap-3 border border-ash bg-pit p-3 text-sm text-linen">
        <Icon name="document" className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <p className="min-w-0 flex-1">{licencia.aviso}</p>
        {licencia.esBorrador && (
          <span className="tag border border-gold/60 text-gold" title={licencia.avisoBorrador}>
            {licencia.etiquetaBorrador}
          </span>
        )}
      </div>

      <PlanSimulador planInicial={licencia.selectorPlan.planInicial} />

      <Banner title={beneficios.titulo} accent="blood" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {beneficios.lista.map((b) => (
          <article key={b.titulo} className="slab flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <Icon name={b.icono} className="h-6 w-6 shrink-0 text-gold" />
              <span className="tag bg-blood text-right text-ivory">{b.aplicaA}</span>
            </div>
            <h3 className="slab-title">{b.titulo}</h3>
            <p className="text-sm text-linen">{b.descripcion}</p>
          </article>
        ))}
      </div>

      <Banner title={reconocimiento.titulo} accent="blood" />
      <section className="slab mb-6">
        <ul className="space-y-2 text-sm text-linen">
          {reconocimiento.reglas.map((r) => (
            <li key={r} className="flex gap-2">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-ash pt-4">
          {reconocimiento.enlaces.map((l) => (
            <Link key={l.href} href={l.href} className="btn-slab gap-2 px-4 py-2">
              <Icon name={l.icono} className="h-4 w-4" />
              {l.texto}
            </Link>
          ))}
        </div>
      </section>

      <Banner title={clausulas.titulo} accent="blood" />
      <section className="mb-6 space-y-2">
        {clausulas.lista.map((c, i) => (
          <details key={c.titulo} className="group border border-ash bg-slab">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="grid h-8 w-8 shrink-0 place-items-center bg-gold font-display text-obsidian">{i + 1}</span>
              <span className="flex-1 font-display uppercase leading-tight tracking-wide sm:text-lg">{c.titulo}</span>
              <span className="text-xl leading-none text-gold transition-transform group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="px-4 pb-4 text-sm text-linen sm:pl-15">{c.texto}</p>
          </details>
        ))}
      </section>

      <Banner title={salida.titulo} accent="blood" />
      <section className="slab mb-6">
        <p className="text-sm font-bold">{salida.intro}</p>
        <ol className="mt-3 space-y-2 text-sm text-linen">
          {salida.pasos.map((p, i) => (
            <li key={p} className="flex gap-3">
              <span className="font-display text-gold">({i + 1})</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-ash pt-4 text-xs text-parchment">
        <p>
          {pie.version} {licencia.version} · {pie.vigenteDesde} {licencia.vigenteDesde}
        </p>
        <p className="mt-1">{pie.ley}</p>
      </footer>
    </>
  );
}
