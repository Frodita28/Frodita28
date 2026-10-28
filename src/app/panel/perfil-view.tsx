import Link from "next/link";
import { Accordion, Badge, PageBanner, SectionHeader, StatCard } from "@/components/ui";
import { Flash } from "@/components/flash";
import { Icon } from "@/components/icons";
import { LicenseCard, type LicenseCardData } from "@/components/license-card";
import { RankCompact } from "@/components/rank-compact";
import { RankRoute } from "@/components/rank-route";
import { RankUnlocks } from "@/components/rank-unlocks";
import { SalesChart } from "@/components/sales-chart";
import { TiendaJuego, type DiaRacha } from "@/components/tienda-juego";
import { formatXp } from "@/lib/missions";
import type { MisionHoy } from "@/lib/misiones-hoy";
import { estadoRango } from "@/lib/rangos";
import { money, units, type StoreSummary } from "@/lib/store";

export type PerfilData = {
  flash: { ok?: string | string[]; error?: string | string[] };
  storeName: string;
  summary: StoreSummary;
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
  const nivel = estadoRango(totalXp).rango.nivel;
  const pendientes = misiones.filter((m) => m.status !== null && m.status !== "completed").length;

  return (
    <>
      {/* Bloques más juntos que el resto del panel: primero los indicadores del negocio, luego ventas y rango. */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <Flash ok={flash.ok} error={flash.error} variant="panel" />
        <PageBanner
          title={storeName}
          aside={
            <Link href="/panel/ventas" className="ui-btn-primary min-h-14 w-full gap-2 px-6 text-base sm:w-auto">
              <Icon name="qr" className="h-5 w-5" /> Punto de venta y registro
            </Link>
          }
        >
          Resumen comercial de tu tienda<span className="hidden sm:inline">. Las cifras salen de las ventas registradas con QR en tu punto de venta</span>.
        </PageBanner>
        <section aria-label="Indicadores del negocio" className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Total generado"
            icon="arrowUp"
            value={money(summary.revenue)}
            hint={summary.investment === 0 ? "Ventas registradas" : `Inversión: ${money(summary.investment)}`}
          />
          <StatCard label="Prendas vendidas" icon="box" value={new Intl.NumberFormat("es-VE").format(summary.unitsSold)} hint={units(summary.unitsSold)} />
          <StatCard
            label="Stock actual"
            icon="store"
            value={new Intl.NumberFormat("es-VE").format(Math.max(summary.stockBalance, 0))}
            hint={
              summary.stockBalance < 0 ? (
                <span className="flex items-start gap-2 text-fg">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />
                  {units(-summary.stockBalance)} sin entrega registrada
                </span>
              ) : summary.unitsDelivered === 0 ? (
                "Sin entregas registradas"
              ) : (
                `${units(summary.unitsDelivered)} recibidas`
              )
            }
          />
          <StatCard
            label="Ranking"
            icon="trophy"
            value={ranking ? `#${ranking.place}` : "—"}
            hint={
              !ranking
                ? "Con licencia activa"
                : ranking.next
                  ? `A ${formatXp(ranking.next.gap)} del #${ranking.next.place}`
                  : `De ${ranking.tiendas} ${ranking.tiendas === 1 ? "tienda" : "tiendas"}`
            }
          />
        </section>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          {/* Ventas vive dentro de Perfil: gráfica y acceso al punto de venta y al registro de ventas. */}
          <section className="ui-card" aria-labelledby="ventas-titulo">
            <SectionHeader
              id="ventas-titulo"
              title="Ventas"
              aside={
                <Link href="/panel/ventas" className="ui-btn-sm min-h-11">
                  Ver registro <Icon name="chevronRight" className="h-4 w-4" />
                </Link>
              }
            >
              Últimos 6 meses
            </SectionHeader>
            <SalesChart months={summary.monthly} />
          </section>
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

        <Accordion title="Ruta de rangos">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <RankRoute nivelActual={nivel} />
            <RankUnlocks nivelActual={nivel} />
          </div>
        </Accordion>
      </div>

      <LicenseCard license={license} today={today} />
    </>
  );
}
