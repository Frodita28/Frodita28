import Link from "next/link";
import { Badge, PageBanner, SectionHeader, StatCard } from "@/components/ui";
import { Flash } from "@/components/flash";
import { Icon } from "@/components/icons";
import { LicenseCard, type LicenseCardData } from "@/components/license-card";
import { RankHero } from "@/components/rank-hero";
import { RankRoute } from "@/components/rank-route";
import { HowToEarnXp, RankUnlocks, type MissionXp } from "@/components/rank-unlocks";
import { SalesChart } from "@/components/sales-chart";
import { requireUser } from "@/lib/auth";
import { parseBoard, xpToNextPlace } from "@/lib/leaderboard";
import { formatXp, todayIn } from "@/lib/missions";
import { estadoRango } from "@/lib/rangos";
import { money, parseStoreSummary, units } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { getMyTotalXp } from "@/lib/xp";

export const metadata = { title: "Tu Tienda" };

export default async function StoreHome({ searchParams }: PageProps<"/panel">) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: license }, { data: rawSummary }, { data: rawBoard }, { data: missionsData }, totalXp] = await Promise.all([
    supabase
      .from("licenses")
      .select("status, territory, starts_at, ends_at, contract_ref, license_plans(name, status, is_demo)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("store_summary", { p_user: user.id, p_months: 6 }),
    supabase.rpc("store_leaderboard", { p_limit: 200 }),
    // La política de la tabla solo entrega las misiones activas que aplican a la tienda.
    supabase.from("missions").select("code, title, frequency, xp_reward").eq("status", "active").order("code"),
    getMyTotalXp(user.id),
  ]);
  const s = parseStoreSummary(rawSummary);
  const board = parseBoard(rawBoard);
  const me = board.find((r) => r.isMe);
  const next = xpToNextPlace(board);
  const storeName = user.storeName ?? "Tu Tienda";
  const { rango } = estadoRango(totalXp);
  const licenseData: LicenseCardData | null = license
    ? {
        status: license.status,
        territory: license.territory,
        starts_at: license.starts_at,
        ends_at: license.ends_at,
        contract_ref: license.contract_ref,
        plan: license.license_plans as unknown as LicenseCardData["plan"],
      }
    : null;

  return (
    <>
      <div className="flex flex-col gap-4">
        <Flash ok={sp.ok} error={sp.error} variant="panel" />
        <PageBanner title={storeName}>
          {user.storeName
            ? "Así va tu tienda Gallo Negro. Las cifras salen de las ventas registradas con QR en tu punto de venta."
            : "Así va tu tienda Gallo Negro. El nombre de tu tienda lo registra Gallo Negro al activar tu cuenta."}
        </PageBanner>
      </div>

      <RankHero totalXp={totalXp} storageKey={`gn:ultimo-xp:${user.id}`} />

      <RankRoute nivelActual={rango.nivel} />

      <section className="flex flex-col gap-4" aria-label="Resumen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Ranking actual"
            icon="trophy"
            size="lg"
            value={me ? `#${me.place}` : "—"}
            hint={
              <span className="flex flex-col gap-1">
                <span>
                  {!me
                    ? "Entras en la clasificación con una licencia activa."
                    : next
                      ? `A ${formatXp(next.gap)} de subir al puesto #${next.place}`
                      : me.place === 1
                        ? `Primer puesto de ${board.length} ${board.length === 1 ? "tienda" : "tiendas"}`
                        : `Puesto ${me.place} de ${board.length}`}
                </span>
                <Link href="/panel/clasificacion" className="ui-link self-start">Ver clasificación</Link>
              </span>
            }
          />

          <div className="ui-card flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <p className="ui-label">Tu squad / equipo</p>
              <Icon name="users" className="h-5 w-5 shrink-0 text-fg-2" />
            </div>
            <div className="mt-3"><Badge>Próximamente</Badge></div>
            <p className="mt-3 text-[13px] text-fg-2">Los equipos entre tiendas aún no están definidos por Gallo Negro.</p>
          </div>

          <StatCard label="Total generado" value={money(s.revenue)} hint="Ventas registradas" />
          <StatCard label="Inversión acumulada" value={money(s.investment)} hint={s.investment === 0 ? "Sin inversiones registradas" : "Registrada por Gallo Negro"} />
          <StatCard label="Prendas vendidas" value={new Intl.NumberFormat("es-VE").format(s.unitsSold)} hint={units(s.unitsSold)} />
          <StatCard
            label="Prendas en stock"
            value={new Intl.NumberFormat("es-VE").format(Math.max(s.stockBalance, 0))}
            hint={
              s.stockBalance < 0 ? (
                <span className="flex items-start gap-2 text-fg">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />
                  Hay {units(-s.stockBalance)} vendidas sin entrega registrada.
                </span>
              ) : s.unitsDelivered === 0 ? (
                "Sin entregas registradas"
              ) : (
                `${units(s.unitsDelivered)} recibidas en total`
              )
            }
          />
        </div>

        <Link href="/panel/ventas" className="ui-btn-primary w-full sm:w-auto sm:self-start">
          <Icon name="qr" /> Abrir punto de venta
        </Link>
      </section>

      <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-6">
        <RankUnlocks nivelActual={rango.nivel} />
        <HowToEarnXp missions={(missionsData ?? []) as MissionXp[]} />
      </div>

      <section className="ui-card">
        <SectionHeader title="Gráfica de ventas" aside={<p className="text-[13px] text-fg-2">Últimos 6 meses · ventas registradas</p>} />
        <SalesChart months={s.monthly} />
      </section>

      <LicenseCard license={licenseData} today={todayIn("America/Caracas")} />
    </>
  );
}
