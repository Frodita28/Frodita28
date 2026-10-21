import Link from "next/link";
import { PageTitle } from "@/components/nav";
import { formatDay, formatXp, todayIn } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Administración" };

type P = { status: string; mission_id: string; missions: { code: string; title: string } | null };

export default async function AdminHome() {
  const supabase = await createClient();
  const today = todayIn("America/Caracas");
  const monthStart = `${today.slice(0, 8)}01`;

  const [openApplications, licensees, pendingEvidence, pendingSales, openFlags, { data: ledger }, { data: parts }, { data: plans }] = await Promise.all([
    supabase.from("license_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "in_review", "needs_info"]),
    supabase.from("licenses").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("mission_evidences").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("sales").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("fraud_flags").select("id", { count: "exact", head: true }).is("resolved_at", null),
    supabase.from("xp_ledger").select("amount, transaction_type").gte("created_at", `${monthStart}T04:00:00Z`),
    supabase.from("mission_participations").select("status, mission_id, missions(code, title)").gte("period_start", monthStart),
    supabase.from("licenses").select("plan_id, license_plans(name)").eq("status", "active"),
  ]);

  const granted = (ledger ?? []).filter((l) => l.transaction_type === "mission_reward").reduce((s, l) => s + l.amount, 0);
  const adjustments = (ledger ?? []).filter((l) => l.transaction_type !== "mission_reward").reduce((s, l) => s + l.amount, 0);

  const byMission = new Map<string, { code: string; title: string; total: number; completed: number; rejected: number }>();
  for (const p of (parts ?? []) as unknown as P[]) {
    const key = p.mission_id;
    const cur = byMission.get(key) ?? { code: p.missions?.code ?? "?", title: p.missions?.title ?? "", total: 0, completed: 0, rejected: 0 };
    cur.total++;
    if (p.status === "completed") cur.completed++;
    if (p.status === "rejected") cur.rejected++;
    byMission.set(key, cur);
  }
  const stats = [...byMission.values()].sort((a, b) => b.completed / b.total - a.completed / a.total || a.code.localeCompare(b.code));

  const perPlan = new Map<string, number>();
  for (const l of (plans ?? []) as unknown as { license_plans: { name: string } | null }[]) {
    const n = l.license_plans?.name ?? "—";
    perPlan.set(n, (perPlan.get(n) ?? 0) + 1);
  }

  return (
    <>
      <PageTitle eyebrow="Administración" title="Resumen">
        Período analizado: {formatDay(monthStart)} – {formatDay(today)} (hora de Caracas). Todos los datos son reales.
      </PageTitle>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Kpi label="Solicitudes por resolver" value={openApplications.count ?? 0} href="/admin/solicitudes" />
        <Kpi label="Licenciados activos" value={licensees.count ?? 0} />
        <Kpi label="Evidencias pendientes" value={pendingEvidence.count ?? 0} href="/admin/revisiones" />
        <Kpi label="Ventas por verificar" value={pendingSales.count ?? 0} href="/admin/ventas" />
        <Kpi label="Alertas abiertas" value={openFlags.count ?? 0} href="/admin/xp" />
        <Kpi label="XP por misiones" value={formatXp(granted)} />
        <Kpi label="Ajustes de XP" value={formatXp(adjustments)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="eyebrow mb-2">Participación por misión (este mes)</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Misión</th><th className="text-right">Participaciones</th><th className="text-right">Completadas</th><th className="text-right">% finalización</th><th className="text-right">Rechazadas</th></tr></thead>
              <tbody>
                {stats.length === 0 && <tr><td colSpan={5} className="text-parchment">Sin participaciones en el período.</td></tr>}
                {stats.map((s) => (
                  <tr key={s.code}>
                    <td><span className="text-parchment">{s.code}</span> {s.title}</td>
                    <td className="text-right">{s.total}</td>
                    <td className="text-right">{s.completed}</td>
                    <td className="text-right">{Math.round((s.completed / s.total) * 100)}%</td>
                    <td className="text-right">{s.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="eyebrow mb-2">Licencias activas por plan</h2>
          <div className="card space-y-1 text-sm">
            {perPlan.size === 0 && <p className="text-parchment">Sin licencias activas.</p>}
            {[...perPlan.entries()].map(([name, n]) => (
              <p key={name} className="flex justify-between"><span>{name}</span><span>{n}</span></p>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <p className="label">{label}</p>
      <p className="font-display text-xl">{value}</p>
    </>
  );
  return href ? <Link href={href} className="card hover:border-bronze">{body}</Link> : <div className="card">{body}</div>;
}
