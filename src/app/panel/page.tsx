import type { LicenseCardData } from "@/components/license-card";
import type { DiaRacha } from "@/components/tienda-juego";
import { requireUser } from "@/lib/auth";
import { parseBoard, xpToNextPlace } from "@/lib/leaderboard";
import { canSubmitEvidence, isPeriodOpen, todayIn, type Frequency, type ParticipationStatus } from "@/lib/missions";
import { ultimos7Dias, type MisionHoy } from "@/lib/misiones-hoy";
import { parseStoreSummary, puntosDiarios } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ, daysAgoIso, utcToZonedLocal } from "@/lib/time";
import { getMyTotalXp } from "@/lib/xp";
import { PerfilView } from "./perfil-view";

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
    supabase.rpc("store_summary", { p_user: user.id, p_months: 12 }),
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
  // Ventas verificadas de los últimos 31 días, para la vista «1 mes» de la gráfica de Perfil.
  const ventasMes = supabase
    .from("sales")
    .select("sold_at, sale_items(quantity, unit_price)")
    .eq("licensee_id", user.id)
    .eq("status", "verified")
    .gte("sold_at", daysAgoIso(31));
  const { data: partData } = await supabase
    .from("mission_participations")
    .select(
      "id, status, current_progress, target_value, xp_reward, period_start, period_end, missions(code, title, frequency, validation_method, metric, target_unit, timezone, status, evidence_instructions), mission_evidences(status)",
    )
    .eq("user_id", user.id)
    .gte("period_end", daysAgoIso(62))
    .order("period_start", { ascending: false });
  const parts = (partData ?? []) as unknown as PartRow[];
  const { data: ventasData } = await ventasMes;
  const porDia = new Map<string, { revenue: number; units: number }>();
  for (const v of (ventasData ?? []) as unknown as { sold_at: string; sale_items: { quantity: number; unit_price: number }[] }[]) {
    const dia = utcToZonedLocal(new Date(v.sold_at), DEFAULT_TZ).slice(0, 10);
    const acc = porDia.get(dia) ?? { revenue: 0, units: 0 };
    for (const i of v.sale_items) {
      acc.revenue += Number(i.quantity) * Number(i.unit_price);
      acc.units += Number(i.quantity);
    }
    porDia.set(dia, acc);
  }

  const s = parseStoreSummary(rawSummary);
  const board = parseBoard(rawBoard);
  const me = board.find((r) => r.isMe);
  const next = xpToNextPlace(board);
  const storeName = user.storeName ?? "Tu Tienda";
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
    <PerfilView
      flash={{ ok: sp.ok, error: sp.error ?? (refreshError ? "No se pudieron actualizar tus misiones" : undefined) }}
      storeName={storeName}
      summary={s}
      ventasDiarias={puntosDiarios(porDia, todayIn(DEFAULT_TZ), 30)}
      ranking={me ? { place: me.place, tiendas: board.length, next } : null}
      totalXp={totalXp}
      misiones={misiones}
      diasConDiaria={diasConDiaria}
      semana={semana}
      hoy={hoy}
      tieneLicencia={activeLicense || current.length > 0}
      userId={user.id}
      license={licenseData}
      today={todayIn("America/Caracas")}
    />
  );
}
