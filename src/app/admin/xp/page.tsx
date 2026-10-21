import { randomUUID } from "node:crypto";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { formatDateTime } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { adjustXp, resolveFlag } from "../actions";

export const metadata = { title: "XP y alertas · Admin" };

type Ledger = { id: number; user_id: string; amount: number; transaction_type: string; description: string; created_at: string; created_by: string | null; profiles: { full_name: string | null; public_alias: string | null } | null };
type Flag = { id: number; user_id: string | null; kind: string; details: Record<string, unknown>; created_at: string; profiles: { full_name: string | null; public_alias: string | null } | null };

const FLAG_LABEL: Record<string, string> = {
  duplicate_evidence: "Evidencia repetida",
  reward_review_needed: "Premio a revisar por venta anulada",
};

export default async function XpAdmin({ searchParams }: PageProps<"/admin/xp">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: ledgerData }, { data: flagData }, { data: licensees }] = await Promise.all([
    supabase.from("xp_ledger").select("id, user_id, amount, transaction_type, description, created_at, created_by, profiles(full_name, public_alias)").order("created_at", { ascending: false }).limit(200),
    supabase.from("fraud_flags").select("id, user_id, kind, details, created_at, profiles(full_name, public_alias)").is("resolved_at", null).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, public_alias").eq("role", "licensee").order("full_name"),
  ]);
  const ledger = (ledgerData ?? []) as unknown as Ledger[];
  const flags = (flagData ?? []) as unknown as Flag[];
  const name = (p: { full_name: string | null; public_alias: string | null } | null, id: string | null) => p?.public_alias ?? p?.full_name ?? id?.slice(0, 8) ?? "—";

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Control" title="XP y alertas">
        El historial de XP es de solo inserción: nada se edita ni se borra. Las correcciones son ajustes motivados que
        quedan en el historial y en la auditoría.
      </PageTitle>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="eyebrow mb-3">Ajuste auditado</h2>
          <form action={adjustXp} className="space-y-3">
            {/* Clave nueva por formulario: reenviar el mismo formulario no duplica el ajuste. */}
            <input type="hidden" name="idempotency_key" value={randomUUID()} />
            <div>
              <label className="label" htmlFor="user_id">Licenciado</label>
              <select className="input" id="user_id" name="user_id" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {(licensees ?? []).map((l) => <option key={l.id} value={l.id}>{name(l, l.id)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="amount">XP (+/−)</label><input className="input" id="amount" name="amount" type="number" required /></div>
              <div><label className="label" htmlFor="participation_id">Participación (opcional)</label><input className="input" id="participation_id" name="participation_id" placeholder="uuid" /></div>
            </div>
            <div><label className="label" htmlFor="reason">Motivo</label><input className="input" id="reason" name="reason" required minLength={5} maxLength={500} /></div>
            <button className="btn-bronze">Registrar ajuste</button>
          </form>
        </section>

        <section>
          <h2 className="eyebrow mb-3">Alertas abiertas ({flags.length})</h2>
          <div className="space-y-2">
            {flags.length === 0 && <p className="card text-sm text-parchment">Sin alertas.</p>}
            {flags.map((f) => (
              <div key={f.id} className="card space-y-2 text-sm">
                <p className="font-semibold">{FLAG_LABEL[f.kind] ?? f.kind} · {name(f.profiles, f.user_id)}</p>
                <p className="text-xs text-parchment">{formatDateTime(f.created_at)} · {Object.entries(f.details).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}</p>
                <form action={resolveFlag} className="flex gap-2">
                  <input type="hidden" name="flag_id" value={f.id} />
                  <input className="input px-2 py-1 text-xs" name="resolution" placeholder="Cómo se resolvió" required minLength={3} maxLength={500} />
                  <button className="btn-ghost px-3 py-1 text-xs">Resolver</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>

      <h2 className="eyebrow mb-2">Historial de XP (últimos 200)</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Licenciado</th><th>Tipo</th><th>Detalle</th><th className="text-right">XP</th></tr></thead>
          <tbody>
            {ledger.length === 0 && <tr><td colSpan={5} className="text-parchment">Sin movimientos.</td></tr>}
            {ledger.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-parchment">{formatDateTime(l.created_at)}</td>
                <td>{name(l.profiles, l.user_id)}</td>
                <td>{l.transaction_type === "mission_reward" ? "Misión" : l.transaction_type === "reversal" ? "Reversión" : "Ajuste"}{l.created_by ? "" : " (sistema)"}</td>
                <td>{l.description}</td>
                <td className={`text-right font-semibold ${l.amount < 0 ? "text-bad" : "text-ok"}`}>{l.amount > 0 ? `+${l.amount}` : l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
