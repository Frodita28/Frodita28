import Image from "next/image";
import Link from "next/link";
import { Accordion, Badge } from "@/components/ui";
import { Flash } from "@/components/flash";
import { Icon, type IconName } from "@/components/icons";
import { LicenseCard, type LicenseCardData } from "@/components/license-card";
import { RankCompact } from "@/components/rank-compact";
import { VentasPanel } from "@/components/sales-line";
import { TiendaJuego, type DiaRacha } from "@/components/tienda-juego";
import type { MisionHoy } from "@/lib/misiones-hoy";
import { money, puntosMensuales, units, type PuntoVentas, type StoreSummary } from "@/lib/store";

export type PerfilData = {
  flash: { ok?: string | string[]; error?: string | string[] };
  storeName: string;
  summary: StoreSummary;
  /** Ventas por día de los últimos 30 días (vista «1 mes» de la gráfica). */
  ventasDiarias: PuntoVentas[];
  /** Puesto en la clasificación (null sin licencia activa). */
  ranking: { place: number; tiendas: number; next: { gap: number; place: number } | null } | null;
  totalXp: number;
  misiones: MisionHoy[];
  diasConDiaria: string[];
  semana: DiaRacha[];
  hoy: string;
  tieneLicencia: boolean;
  userId: string;
  license: LicenseCardData | null;
  today: string;
};

/**
 * Perfil (/panel) con enfoque comercial: botón grande del punto de venta, indicadores del negocio
 * arriba, ventas y rango compacto; misiones y ruta de rangos quedan plegadas en acordeones.
 */
export function PerfilView({
  flash,
  storeName,
  summary,
  ventasDiarias,
  ranking,
  totalXp,
  misiones,
  diasConDiaria,
  semana,
  hoy,
  tieneLicencia,
  userId,
  license,
  today,
}: PerfilData) {
  const pendientes = misiones.filter((m) => m.status !== null && m.status !== "completed").length;

  return (
    <>
      {/* Bloques más juntos que el resto del panel: primero los indicadores del negocio, luego ventas y rango. */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <Flash ok={flash.ok} error={flash.error} variant="panel" />
        {/* Banner de bienvenida con el gallo (tema del mockup de Perfil). */}
        <section className="relative isolate overflow-hidden rounded-card border border-line bg-black">
          <Image
            src="/perfil/gallo-banner.jpg"
            alt=""
            width={285}
            height={207}
            priority
            className="absolute inset-y-0 right-0 -z-10 h-full w-[62%] object-cover object-left sm:w-[45%]"
            style={{ maskImage: "linear-gradient(to right, transparent, black 45%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 45%)" }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/85 to-black/10" aria-hidden />
          <div className="flex min-h-44 flex-col justify-center gap-2 p-5 sm:min-h-52 sm:p-8">
            <p className="text-[13px] font-semibold tracking-[0.25em] text-fg-2 uppercase">Bienvenido,</p>
            <h1 className="max-w-[75%] border-l-2 border-gold pl-3 font-title text-[clamp(1.75rem,8vw,2.75rem)] leading-none font-black uppercase [overflow-wrap:anywhere]">
              {storeName}
            </h1>
            <p className="max-w-[60%] text-[15px] text-fg-2 sm:max-w-sm">Disciplina también es hacer crecer tu negocio.</p>
            <span className="mt-1 block h-px w-12 bg-gold" aria-hidden />
          </div>
        </section>

        {/* Acceso principal: solo el QR y «¡Listo para vender!», grande y fácil de pulsar. */}
        <Link
          href="/panel/ventas"
          aria-label="Punto de venta y registro"
          className="group flex min-h-24 items-center gap-4 rounded-card border border-gold/70 bg-gradient-to-r from-[#1c160b] to-black p-4 shadow-[0_0_24px_-8px_var(--gold)] transition-colors hover:border-gold sm:p-5"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-ui border border-line bg-black">
            <Icon name="qr" className="h-7 w-7 text-gold" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 font-title text-[clamp(1.05rem,5vw,1.375rem)] leading-tight font-extrabold text-gold">
            <Icon name="bag" className="h-6 w-6 shrink-0" />
            ¡Listo para vender!
          </span>
          <Icon name="chevronRight" className="h-6 w-6 shrink-0 text-gold transition-transform group-hover:translate-x-1" />
        </Link>

        <section aria-label="Indicadores del negocio" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <Kpi label="Total generado" icon="chartUp" value={money(summary.revenue)} glow>
            <Sparkline values={summary.monthly.slice(-6).map((m) => m.revenue)} />
          </Kpi>
          <Kpi label="Prendas vendidas" icon="box" value={new Intl.NumberFormat("es-VE").format(summary.unitsSold)} figure="shirt" />
          <Kpi label="Stock actual" icon="box" value={new Intl.NumberFormat("es-VE").format(Math.max(summary.stockBalance, 0))} figure="store">
            {/* Solo se avisa si hay ventas sin entrega registrada (stock negativo). */}
            {summary.stockBalance < 0 && (
              <p className="flex items-start gap-2 text-[13px] text-fg">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                {units(-summary.stockBalance)} sin entrega
              </p>
            )}
          </Kpi>
          <Kpi label="Ranking" icon="trophy" value={ranking ? `#${ranking.place}` : "—"} figure="crown" />
        </section>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          {/* Ventas vive dentro de Perfil: gráfica con selector de período y acceso al registro. */}
          <VentasPanel diarias={ventasDiarias} mensuales={puntosMensuales(summary.monthly)} />
          <RankCompact totalXp={totalXp} />
        </div>

        <Accordion
          title={
            <span className="flex flex-wrap items-center gap-2">
              Misiones de hoy
              {pendientes > 0 && <Badge>{pendientes} pendientes</Badge>}
            </span>
          }
        >
          <TiendaJuego
            misiones={misiones}
            diasConDiaria={diasConDiaria}
            semana={semana}
            hoy={hoy}
            totalXp={totalXp}
            tieneLicencia={tieneLicencia}
            userId={userId}
            acciones={null}
          />
        </Accordion>

      </div>

      <LicenseCard license={license} today={today} />
    </>
  );
}

/** Tarjeta de indicador del tema de Perfil: icono dorado, cifra grande y figura opcional abajo a la derecha. */
function Kpi({
  label,
  icon,
  value,
  figure,
  glow,
  children,
}: {
  label: string;
  icon: IconName;
  value: string;
  figure?: IconName;
  glow?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-gradient-to-b from-surface to-black p-4 sm:p-5 ${
        glow ? "shadow-[inset_0_-40px_40px_-30px_color-mix(in_srgb,var(--gold)_35%,transparent)]" : ""
      }`}
    >
      <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-fg uppercase sm:text-xs">
        <Icon name={icon} className="h-4 w-4 shrink-0 text-gold" />
        <span className="min-w-0">{label}</span>
      </p>
      <p className="ui-num mt-3 text-[clamp(1.5rem,7vw,2.25rem)] leading-none font-bold [overflow-wrap:anywhere]">{value}</p>
      {children && <div className={`mt-2 flex flex-col gap-2 ${figure ? "pr-12" : ""}`}>{children}</div>}
      {figure && (
        <span className="absolute right-3 bottom-3 grid h-11 w-11 place-items-center rounded-ui border border-line bg-surface-2" aria-hidden>
          <Icon name={figure} className="h-6 w-6 text-fg-2" />
        </span>
      )}
    </div>
  );
}

/** Mini gráfico de tendencia (línea dorada con relleno suave). */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(0, ...values);
  if (values.length < 2) return null;
  const pts = values.map((v, i) => `${(i * 100) / (values.length - 1)},${28 - (max ? (v / max) * 24 : 0)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="-mx-1 h-8 w-[calc(100%+0.5rem)]" aria-hidden>
      <polygon points={`0,30 ${pts} 100,30`} fill="var(--gold)" opacity="0.15" />
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
