import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { RANGOS } from "@/content/rangos";
import { formatGn, formatNum, formatUsd } from "@/lib/gn";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { adjustGn, setIdentity } from "../actions";
import { nombre } from "../shared";

export const metadata = { title: "Licenciatarios GN · Admin" };

type Account = { user_id: string; available: number; pending: number; held: number; debt: number };
type Ledger = { id: number; kind: string; d_pending: number; d_available: number; d_held: number; d_debt: number; description: string; created_at: string; created_by: string | null };
type RankState = {
  level: number;
  computed_level: number;
  xp: number;
  sales_usd: number;
  requirements: { code: string; level: number; name: string; description: string; auto: boolean; met: boolean }[];
  rangos: { nivel: number; xp: number; ventas: number }[];
};

const rango = (n: number) => RANGOS.find((r) => r.nivel === n)?.nombre ?? `Rango ${n}`;
const signo = (n: number) => (n > 0 ? `+${formatNum(n)}` : n < 0 ? `−${formatNum(-n)}` : "");

export default async function LicenciatariosGnAdmin({ searchParams }: PageProps<"/admin/recompensas/licenciatarios">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: people }, { data: accs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, public_alias").eq("role", "licensee").order("full_name"),
    supabase.from("gn_accounts").select("user_id, available, pending, held, debt"),
  ]);
  const accOf = new Map(((accs ?? []) as Account[]).map((a) => [a.user_id, a]));
  const u = typeof sp.u === "string" ? sp.u : null;
  const person = u ? (people ?? []).find((p) => p.id === u) : null;

  let detail: { rank: RankState | null; ledger: Ledger[] } | null = null;
  if (person) {
    const [{ data: rank }, { data: ledger }] = await Promise.all([
      supabase.rpc("admin_rank_state", { p_user: person.id }),
      supabase.from("gn_ledger").select("id, kind, d_pending, d_available, d_held, d_debt, description, created_at, created_by").eq("user_id", person.id).order("id", { ascending: false }).limit(200),
    ]);
    detail = { rank: rank as RankState | null, ledger: (ledger ?? []) as Ledger[] };
  }
  const acc = person ? accOf.get(person.id) : undefined;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Recompensas GN" title="Licenciatarios">
        Saldo, movimientos, rango y requisitos de identidad. El libro de GN es de solo inserción: las correcciones son ajustes
        con motivo que quedan en la auditoría.
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <nav aria-label="Licenciatarios" className="space-y-1">
          {(people ?? []).length === 0 && <p className="card text-sm text-parchment">No hay licenciatarios.</p>}
          {(people ?? []).map((p) => {
            const a = accOf.get(p.id);
            return (
              <Link
                key={p.id}
                href={`/admin/recompensas/licenciatarios?u=${p.id}`}
                aria-current={p.id === u ? "page" : undefined}
                className={`card flex min-h-11 items-center justify-between gap-2 py-2 text-sm ${p.id === u ? "border-bronze" : ""}`}
              >
                <span className="min-w-0 truncate">{nombre(p, p.id)}</span>
                <span className="shrink-0 text-parchment">{formatGn(a?.available ?? 0)}{a?.debt ? ` · −${formatNum(a.debt)}` : ""}</span>
              </Link>
            );
          })}
        </nav>

        {!person && <p className="card text-sm text-parchment">Elige un licenciatario para ver su detalle.</p>}
        {person && detail && (
          <div className="min-w-0 space-y-6">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Cifra label="Disponibles" value={formatGn(acc?.available ?? 0)} />
              <Cifra label="En espera" value={formatGn(acc?.pending ?? 0)} />
              <Cifra label="Retenidos en canjes" value={formatGn(acc?.held ?? 0)} />
              <Cifra label="Saldo por cubrir" value={formatGn(acc?.debt ?? 0)} />
            </section>

            {detail.rank && (
              <section className="card space-y-3 text-sm">
                <h2 className="eyebrow">Rango: {rango(detail.rank.level)}</h2>
                <p className="text-parchment">
                  {formatNum(detail.rank.xp)} XP · {formatUsd(Number(detail.rank.sales_usd))} en ventas verificadas
                  {detail.rank.computed_level < detail.rank.level ? ` · hoy cumple ${rango(detail.rank.computed_level)}; el rango alcanzado no baja` : ""}
                </p>
                <ul className="divide-y divide-smoke">
                  {detail.rank.requirements.map((q) => (
                    <li key={q.code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className={q.met ? "text-ok" : ""}>{q.met ? "✓ " : "○ "}</span>
                        {rango(q.level)} · {q.name}
                        {q.auto && <span className="ml-1 text-xs text-parchment">(automático)</span>}
                      </span>
                      {!q.auto && (
                        <form action={setIdentity} className="flex gap-2">
                          <input type="hidden" name="user_id" value={person.id} />
                          <input type="hidden" name="code" value={q.code} />
                          <input type="hidden" name="decision" value={q.met ? "revocar" : "aprobar"} />
                          <label className="sr-only" htmlFor={`nota-${q.code}`}>Nota</label>
                          <input className="input w-36 px-2 py-1 text-base" id={`nota-${q.code}`} name="note" placeholder="Nota" maxLength={300} />
                          <button className={`${q.met ? "btn-danger" : "btn-bronze"} px-3 py-1 text-xs`}>{q.met ? "Revocar" : "Aprobar"}</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card">
              <h2 className="eyebrow mb-3">Ajuste de GN</h2>
              <form action={adjustGn} className="grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
                <input type="hidden" name="user_id" value={person.id} />
                {/* Clave nueva por carga: reenviar el mismo formulario no duplica el ajuste. */}
                <input type="hidden" name="idempotency_key" value={randomUUID()} />
                <div><label className="label" htmlFor="amount">GN (+/−)</label><input className="input text-base" id="amount" name="amount" type="number" required /></div>
                <div><label className="label" htmlFor="reason">Motivo (obligatorio)</label><input className="input text-base" id="reason" name="reason" required minLength={5} maxLength={300} /></div>
                <button className="btn-bronze min-h-11">Registrar</button>
              </form>
              <p className="mt-2 text-xs text-parchment">Un ajuste negativo descuenta de lo disponible; lo que falte queda como saldo por cubrir.</p>
            </section>

            <section>
              <h2 className="eyebrow mb-2">Movimientos (últimos 200)</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Detalle</th><th className="text-right">Espera</th><th className="text-right">Disponible</th><th className="text-right">Retenido</th><th className="text-right">Por cubrir</th></tr></thead>
                  <tbody>
                    {detail.ledger.length === 0 && <tr><td colSpan={6} className="text-parchment">Sin movimientos.</td></tr>}
                    {detail.ledger.map((l) => (
                      <tr key={l.id}>
                        <td className="whitespace-nowrap text-parchment">{formatDateTime(l.created_at)}</td>
                        <td>{l.description}{l.created_by ? "" : <span className="ml-1 text-xs text-parchment">(sistema)</span>}</td>
                        <td className="text-right">{signo(l.d_pending)}</td>
                        <td className={`text-right font-semibold ${l.d_available < 0 ? "text-bad" : "text-ok"}`}>{signo(l.d_available)}</td>
                        <td className="text-right">{signo(l.d_held)}</td>
                        <td className="text-right">{signo(l.d_debt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Cifra({ label, value }: { label: string; value: string }) {
  return (
    <div className="card min-w-0">
      <p className="label">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
