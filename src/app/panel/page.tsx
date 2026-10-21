import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { formatDay, formatXp } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

export const metadata = { title: "Panel" };

export default async function PanelHome({ searchParams }: PageProps<"/panel">) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: license }, { data: balance }] = await Promise.all([
    supabase
      .from("licenses")
      .select("status, territory, starts_at, ends_at, contract_ref, license_plans(name, status, is_demo)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("user_xp_balances").select("total_xp").eq("user_id", user.id).maybeSingle(),
  ]);
  const plan = license?.license_plans as unknown as { name: string; status: string; is_demo: boolean } | null;

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Panel del licenciado" title={`Hola, ${user.publicAlias ?? user.fullName ?? "licenciado"}`} />

      <div className="grid gap-4 md:grid-cols-3">
        <section className="card md:col-span-2">
          <h2 className="eyebrow mb-3">Mi licencia</h2>
          {license ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="label">Plan</dt><dd>{plan?.name}{plan?.is_demo && <span className="ml-2 text-xs text-warn">(provisional)</span>}</dd></div>
              <div><dt className="label">Estado</dt><dd className="capitalize">{license.status}</dd></div>
              <div><dt className="label">Territorio</dt><dd>{license.territory ?? "—"}</dd></div>
              <div><dt className="label">Vigencia</dt><dd>{license.starts_at ? formatDay(license.starts_at) : "—"} – {license.ends_at ? formatDay(license.ends_at) : "sin fecha"}</dd></div>
              <div className="col-span-2"><dt className="label">Contrato</dt><dd>{license.contract_ref ?? "Pendiente de registrar"}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-linen">
              Tu cuenta todavía no tiene una licencia activa. Gallo Negro revisa cada solicitud y activa la licencia
              después de formalizar el contrato y el pago.
            </p>
          )}
        </section>
        <section className="card">
          <h2 className="eyebrow mb-3">Mis XP</h2>
          <p className="font-display text-3xl">{formatXp(Number(balance?.total_xp ?? 0))}</p>
          <p className="mt-2 text-xs text-parchment">Los XP miden tu actividad. No representan dinero ni garantizan beneficios económicos.</p>
          <Link href="/panel/misiones" className="btn-bronze mt-4 w-full">Ver misiones</Link>
        </section>
      </div>

      <section className="card mt-4 max-w-xl">
        <h2 className="eyebrow mb-3">Perfil público</h2>
        <p className="mb-3 text-xs text-parchment">El alias es lo único que verán otros licenciados en rankings y comunidad.</p>
        <form action={updateProfile} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="full_name">Nombre</label>
            <input className="input" id="full_name" name="full_name" defaultValue={user.fullName ?? ""} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="public_alias">Alias comercial</label>
            <input className="input" id="public_alias" name="public_alias" defaultValue={user.publicAlias ?? ""} minLength={2} maxLength={40} />
          </div>
          <button className="btn-ghost sm:col-span-2 sm:justify-self-start">Guardar perfil</button>
        </form>
      </section>
    </>
  );
}
