import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { TEXTOS_CLAN as T } from "@/content/recompensas";
import { formatGn, formatNum } from "@/lib/gn";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { setRedemptionStatus } from "../actions";
import { nombre, senal, type ProfileRef } from "../shared";

export const metadata = { title: "Canjes · Admin" };

type Row = {
  id: string;
  user_id: string;
  product_name: string;
  price_gn: number;
  status: string;
  delivery: Record<string, string>;
  substitute_note: string | null;
  admin_note: string | null;
  flags: unknown[];
  created_at: string;
  profiles: ProfileRef;
  clan_redemption_events: { id: number; from_status: string | null; to_status: string; note: string | null; created_at: string }[];
};

// Igual que clan_admin_set_status (la base de datos vuelve a validar el paso).
const SIGUIENTES: Record<string, string[]> = {
  solicitado: ["aprobado", "rechazado"],
  aprobado: ["en_preparacion", "sustituido", "enviado", "rechazado", "cancelado"],
  sustituido: ["en_preparacion", "enviado", "cancelado"],
  en_preparacion: ["sustituido", "enviado", "rechazado", "cancelado"],
  enviado: ["entregado"],
};
const ABIERTOS = ["solicitado", "aprobado", "en_preparacion", "sustituido", "enviado"];
const FILTROS = { abiertos: "Por atender", todos: "Todos", cerrados: "Cerrados" } as const;
const CAMPOS: Record<string, string> = { nombre: "Nombre", telefono: "Teléfono", ciudad: "Ciudad", direccion: "Dirección", notas: "Notas" };

export default async function CanjesAdmin({ searchParams }: PageProps<"/admin/recompensas/canjes">) {
  const sp = await searchParams;
  const filtro = (typeof sp.ver === "string" && sp.ver in FILTROS ? sp.ver : "abiertos") as keyof typeof FILTROS;
  const supabase = await createClient();
  let q = supabase
    .from("clan_redemptions")
    .select("id, user_id, product_name, price_gn, status, delivery, substitute_note, admin_note, flags, created_at, profiles(full_name, public_alias), clan_redemption_events(id, from_status, to_status, note, created_at)")
    .order("created_at", { ascending: filtro === "abiertos" })
    .limit(200);
  if (filtro === "abiertos") q = q.in("status", ABIERTOS);
  if (filtro === "cerrados") q = q.in("status", ["entregado", "rechazado", "cancelado"]);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const back = `/admin/recompensas/canjes?ver=${filtro}`;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Recompensas GN" title="Cola de canjes">
        Los GN quedan retenidos al pedir el canje. Rechazar o cancelar los devuelve; al marcar Entregado se descuentan del todo.
        Las señales marcan casos para revisar con calma, no bloquean. No puedes gestionar tus propios canjes.
      </PageTitle>

      <nav className="mb-4 flex gap-2" aria-label="Filtro de canjes">
        {Object.entries(FILTROS).map(([k, l]) => (
          <Link key={k} href={`/admin/recompensas/canjes?ver=${k}`} aria-current={k === filtro ? "page" : undefined} className={`btn-ghost min-h-11 ${k === filtro ? "border-bronze text-ivory" : ""}`}>
            {l}
          </Link>
        ))}
      </nav>

      {rows.length === 0 && <p className="card text-sm text-parchment">No hay canjes en esta vista.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => {
          const next = SIGUIENTES[r.status] ?? [];
          return (
            <article key={r.id} className="card space-y-3 text-sm">
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-parchment">{nombre(r.profiles, r.user_id)} · {formatDateTime(r.created_at)}</p>
                  <h2 className="font-semibold [overflow-wrap:anywhere]">{r.product_name}</h2>
                  <p className="text-parchment">{formatGn(r.price_gn)}</p>
                </div>
                <span className="rounded-full border border-smoke px-2 py-0.5 text-xs">{T.estados[r.status] ?? r.status}</span>
              </header>

              {r.flags.length > 0 && (
                <ul className="flex flex-wrap gap-1" aria-label="Señales">
                  {r.flags.map((f, i) => <li key={i} className="rounded-full border border-bad/60 px-2 py-0.5 text-xs text-bad">{senal(f)}</li>)}
                </ul>
              )}

              {Object.keys(r.delivery).length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-smoke p-3">
                  {Object.entries(r.delivery).filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-parchment">{CAMPOS[k] ?? k}</dt>
                      <dd className="[overflow-wrap:anywhere]">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {r.substitute_note && <p>Sustituido por: {r.substitute_note}</p>}
              {r.admin_note && <p className="text-parchment">Nota: {r.admin_note}</p>}

              {next.length > 0 && (
                <form action={setRedemptionStatus} className="space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="return_to" value={back} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label" htmlFor={`st-${r.id}`}>Pasar a</label>
                      <select className="input text-base" id={`st-${r.id}`} name="status" defaultValue={next[0]}>
                        {next.map((s) => <option key={s} value={s}>{T.estados[s] ?? s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor={`sub-${r.id}`}>Sustituto (si aplica)</label>
                      <input className="input text-base" id={`sub-${r.id}`} name="substitute" maxLength={200} />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor={`note-${r.id}`}>Nota o motivo (obligatorio al rechazar o cancelar)</label>
                    <input className="input text-base" id={`note-${r.id}`} name="note" maxLength={500} />
                  </div>
                  <button className="btn-bronze min-h-11">Actualizar</button>
                </form>
              )}

              {r.clan_redemption_events.length > 0 && (
                <details>
                  <summary className="min-h-11 cursor-pointer py-2 text-parchment">Historial ({formatNum(r.clan_redemption_events.length)})</summary>
                  <ol className="space-y-1 text-xs text-parchment">
                    {[...r.clan_redemption_events].sort((a, b) => a.id - b.id).map((e) => (
                      <li key={e.id}>
                        {formatDateTime(e.created_at)} · {e.from_status ? `${T.estados[e.from_status] ?? e.from_status} → ` : ""}{T.estados[e.to_status] ?? e.to_status}
                        {e.note ? ` · ${e.note}` : ""}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
