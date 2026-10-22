import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { Pill } from "@/components/status-badge";
import { formatDay } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";
import { serviceRoleConfigured } from "@/lib/supabase/admin";
import { createAccount, resetAccountPassword } from "./actions";

export const metadata = { title: "Usuarios · Admin" };

const ROLES = [["licensee", "Licenciado (tienda)"], ["applicant", "Solicitante"], ["admin", "Administrador"]] as const;

type Account = { id: string; username: string | null; full_name: string | null; store_name: string | null; role: string; created_at: string };

export default async function Users({ searchParams }: PageProps<"/admin/usuarios">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: plans }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, store_name, role, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("license_plans").select("id, name, is_demo").neq("status", "inactive").order("sort_order"),
  ]);
  const accounts = (data ?? []) as Account[];
  const ready = serviceRoleConfigured();

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Acceso" title="Usuarios">
        No hay registro público: solo entra quien tenga una cuenta creada aquí. Cada persona inicia sesión con su
        usuario y contraseña. Un licenciado nuevo recibe una licencia activa en el plan elegido (o el primero
        disponible). Entrega las contraseñas por un canal privado: las tiendas no pueden cambiarlas, solo tú desde aquí.
      </PageTitle>

      {!ready && (
        <p className="card mb-6 text-sm text-linen">
          Para crear cuentas desde aquí, configura <code>SUPABASE_SERVICE_ROLE_KEY</code> en las variables del servidor
          (Vercel). Mientras tanto, sigue la guía de despliegue para crearlas desde el panel de Supabase.
        </p>
      )}

      <section className="card mb-6">
        <h2 className="eyebrow mb-4">Crear cuenta</h2>
        <form action={createAccount} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="username">Usuario</label>
            <input className="input" id="username" name="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,29}" autoCapitalize="none" spellCheck={false} />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña (mínimo 6)</label>
            <input className="input" id="password" name="password" type="text" required minLength={6} maxLength={72} autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="role">Rol</label>
            <select className="input" id="role" name="role" defaultValue="licensee">
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="full_name">Nombre de la persona</label><input className="input" id="full_name" name="full_name" maxLength={120} /></div>
          <div><label className="label" htmlFor="store_name">Nombre de la tienda</label><input className="input" id="store_name" name="store_name" minLength={2} maxLength={60} /></div>
          <div>
            <label className="label" htmlFor="plan_id">Plan (solo licenciados)</label>
            <select className="input" id="plan_id" name="plan_id" defaultValue="">
              <option value="">Primer plan disponible</option>
              {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_demo ? " (provisional)" : ""}</option>)}
            </select>
          </div>
          <button className="btn-bronze sm:col-span-2 lg:col-span-3 lg:justify-self-start" disabled={!ready}>Crear cuenta</button>
        </form>
      </section>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Alta</th><th>Asignar contraseña</th></tr></thead>
          <tbody>
            {accounts.length === 0 && <tr><td colSpan={5} className="text-parchment">Sin cuentas.</td></tr>}
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.username ?? <span className="text-parchment">— (entra con su correo)</span>}</td>
                <td>{a.store_name ?? a.full_name ?? "—"}{a.store_name && a.full_name && <div className="text-xs text-parchment">{a.full_name}</div>}</td>
                <td><Pill tone={a.role === "admin" ? "ok" : "neutral"}>{ROLES.find(([v]) => v === a.role)?.[1] ?? a.role}</Pill></td>
                <td className="whitespace-nowrap text-xs">{formatDay(a.created_at.slice(0, 10))}</td>
                <td>
                  <form action={resetAccountPassword} className="flex gap-1">
                    <input type="hidden" name="user_id" value={a.id} />
                    <input className="input px-2 py-1 text-xs" name="password" type="text" required minLength={6} maxLength={72} autoComplete="off" placeholder="Nueva contraseña" aria-label={`Nueva contraseña para ${a.username ?? a.full_name ?? "la cuenta"}`} />
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={!ready}>Asignar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
