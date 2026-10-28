import Link from "next/link";
import { Badge, PageBanner, SectionHeader, StatCard } from "@/components/ui";
import { AccionesRapidas } from "@/components/acciones-rapidas";
import { Flash } from "@/components/flash";
import { Icon } from "@/components/icons";
import { LicenseCard, type LicenseCardData } from "@/components/license-card";
import { RankHero } from "@/components/rank-hero";
import { RankMiniBar } from "@/components/rank-mini-bar";
import { RankRoute } from "@/components/rank-route";
import { RankUnlocks } from "@/components/rank-unlocks";
import { SalesChart } from "@/components/sales-chart";
import { TiendaJuego, type DiaRacha } from "@/components/tienda-juego";
import { requireUser } from "@/lib/auth";
import { parseBoard, xpToNextPlace } from "@/lib/leaderboard";
import { canSubmitEvidence, formatXp, isPeriodOpen, todayIn, type Frequency, type ParticipationStatus } from "@/lib/missions";
import { ultimos7Dias, type MisionHoy } from "@/lib/misiones-hoy";
import { estadoRango } from "@/lib/rangos";
import { money, parseStoreSummary, units } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { daysAgoIso } from "@/lib/time";
import { getMyTotalXp } from "@/lib/xp";

export const metadata = { title: "Perfil" };

type MissionInfo = {
  code: string;
  title: string;
  frequency: Frequency;
  validation_method: "auto" | "manual";
  metric: string;
  target_unit: string;
  timezone: string;
  status: string;
  evidence_instructions: string;
};

type PartRow = {
  id: string;
  status: ParticipationStatus;
  current_progress: number | null;
  target_value: number;
  xp_reward: number;
  period_start: string;
  period_end: string;
  missions: MissionInfo;
  mission_evidences: { status: string }[];
};

export default async function StoreHome({ searchParams }: PageProps<"/panel">) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: license }, { data: rawSummary }, { data: rawBoard }, { data: missionsData }, totalXp, { error: refreshError }] = await Promise.all([
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
    supabase
      .from("missions")
      .select("code, title, frequency, xp_reward, validation_method, metric, target_unit, evidence_instructions")
      .eq("status", "active")
      .order("code"),
    getMyTotalXp(user.id),
    // Abre los períodos actuales y actualiza estados (lo mismo que hace /panel/misiones al cargar).
    supabase.rpc("refresh_my_missions"),
  ]);
  // Participaciones del período actual y de las últimas semanas (para la racha), con sus evidencias.
  const { data: partData } = await supabase
    .from("mission_participations")
    .select(
      "id, status, current_progress, target_value, xp_reward, period_start, period_end, missions(code, title, frequency, validation_method, metric, target_unit, timezone, status, evidence_instructions), mission_evidences(status)",
    )
    .eq("user_id", user.id)
    .gte("period_end", daysAgoIso(62))
    .order("period_start", { ascending: false });
  const parts = (partData ?? []) as unknown as PartRow[];

  const s = parseStoreSummary(rawSummary);
  const board = parseBoard(rawBoard);
  const me = board.find((r) => r.isMe);
  const next = xpToNextPlace(board);
  const storeName = user.storeName ?? "Tu Tienda";
  const { rango } = estadoRango(totalXp);
  const activeLicense = license?.status === "active";
  const tz = parts[0]?.missions.timezone ?? "America/Caracas";
  const hoy = todayIn(tz);

  // Misiones del período en curso, con el mismo criterio de /panel/misiones.
  const current = parts.filter((p) => {
    const t = todayIn(p.missions.timezone);
    return p.missions.status === "active" && p.period_start <= t && t <= p.period_end;
  });
  const misiones: MisionHoy[] =
    current.length > 0
      ? current.map((p) => {
          const m = p.missions;
          const target = Number(p.target_value);
          const enCurso = p.mission_evidences.filter((e) => e.status !== "rejected").length;
          const needed = m.metric === "manual_approval" ? 1 : target;
          return {
            id: p.id,
            code: m.code,
            title: m.title,
            frequency: m.frequency,
            xp: p.xp_reward,
            status: p.status,
            progress: p.current_progress === null ? null : Number(p.current_progress),
            target,
            unit: m.target_unit,
            validation: m.validation_method,
            metric: m.metric,
            instructions: m.evidence_instructions,
            canSend: canSubmitEvidence(p.status, m.validation_method, isPeriodOpen(p.period_end, todayIn(m.timezone))) && enCurso < needed,
          };
        })
      : // Sin participaciones (sin licencia activa): las misiones se ven como no disponibles.
        ((missionsData ?? []) as (Omit<MissionInfo, "timezone" | "status"> & { xp_reward: number })[]).map((m) => ({
          id: m.code,
          code: m.code,
          title: m.title,
          frequency: m.frequency,
          xp: m.xp_reward,
          status: null,
          progress: null,
          target: 0,
          unit: m.target_unit,
          validation: m.validation_method,
          metric: m.metric,
          instructions: m.evidence_instructions,
          canSend: false,
        }));

  // Racha: días (period_start de la diaria) con al menos una misión diaria completada.
  const diarias = parts.filter((p) => p.missions.frequency === "daily" && p.status === "completed");
  const diasConDiaria = [...new Set(diarias.map((p) => p.period_start))];
  const semana: DiaRacha[] = ultimos7Dias(hoy).map((dia) => ({
    dia,
    misiones: diarias.filter((p) => p.period_start === dia).map((p) => ({ titulo: p.missions.title, xp: p.xp_reward })),
  }));

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
        <Flash ok={sp.ok} error={sp.error ?? (refreshError ? "No se pudieron actualizar tus misiones" : undefined)} variant="panel" />
        <PageBanner title={storeName}>
          {user.storeName
            ? "Así va tu tienda Gallo Negro. Las cifras salen de las ventas registradas con QR en tu punto de venta."
            : "Así va tu tienda Gallo Negro. El nombre de tu tienda lo registra Gallo Negro al activar tu cuenta."}
        </PageBanner>
      </div>

      <RankHero totalXp={totalXp} storageKey={`gn:ultimo-xp:${user.id}`} />
      <RankMiniBar totalXp={totalXp} />

      <TiendaJuego
        misiones={misiones}
        diasConDiaria={diasConDiaria}
        semana={semana}
        hoy={hoy}
        totalXp={totalXp}
        tieneLicencia={activeLicense || current.length > 0}
        userId={user.id}
        acciones={<AccionesRapidas />}
      />

      <section aria-label="Resumen">
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
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
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start lg:gap-6">
        <RankRoute nivelActual={rango.nivel} />
        <RankUnlocks nivelActual={rango.nivel} />
      </div>

      {/* Ventas vive dentro de Perfil: gráfica y acceso al punto de venta y al registro de ventas. */}
      <section className="ui-card" aria-labelledby="ventas-titulo">
        <SectionHeader
          id="ventas-titulo"
          title="Ventas"
          aside={
            <Link href="/panel/ventas" className="ui-btn-sm">
              <Icon name="qr" className="h-4 w-4" /> Punto de venta y registro
            </Link>
          }
        >
          Últimos 6 meses · ventas registradas
        </SectionHeader>
        <SalesChart months={s.monthly} />
      </section>

      <LicenseCard license={licenseData} today={todayIn("America/Caracas")} />
    </>
  );
}
