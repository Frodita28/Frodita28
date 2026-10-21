import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { ProgressBar } from "@/components/progress";
import { SalesChart } from "@/components/sales-chart";
import { requireUser } from "@/lib/auth";
import { formatDay, formatXp } from "@/lib/missions";
import { money, parseStoreSummary, units } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
import { updateStore } from "./actions";

export const metadata = { title: "Tu Tienda" };

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="font-display text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-parchment">{hint}</p>}
    </div>
  );
}

export default async function StoreHome({ searchParams }: PageProps<"/panel">) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: license }, { data: rawSummary }] = await Promise.all([
    supabase
      .from("licenses")
      .select("status, territory, starts_at, ends_at, contract_ref, license_plans(name, status, is_demo)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("store_summary", { p_user: user.id, p_months: 6 }),
  ]);
  const plan = license?.license_plans as unknown as { name: string; status: string; is_demo: boolean } | null;
  const s = parseStoreSummary(rawSummary);
  const storeName = user.storeName ?? "Tu Tienda";

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Tu Tienda" title={storeName}>
        {user.storeName ? (
          "Así va tu tienda Gallo Negro. Las cifras solo cuentan ventas verificadas por la marca."
        ) : (
          <>Ponle nombre a tu tienda en <a href="#datos-tienda" className="text-bronze underline">Datos de tu tienda</a>.</>
        )}
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total generado con la licencia" value={money(s.revenue)} hint="Ventas verificadas" />
        <Stat label="Inversión acumulada" value={money(s.investment)} hint={s.investment === 0 ? "Sin inversiones registradas" : "Registrada por Gallo Negro"} />
        <Stat label="Prendas vendidas" value={s.unitsSold} hint={units(s.unitsSold)} />
        <Stat
          label="Prendas en stock"
          value={Math.max(s.stockBalance, 0)}
          hint={
            s.stockBalance < 0 ? (
              <span className="text-warn">Hay {units(-s.stockBalance)} vendidas sin entrega registrada.</span>
            ) : s.unitsDelivered === 0 ? (
              "Sin entregas registradas"
            ) : (
              `${units(s.unitsDelivered)} recibidas en total`
            )
          }
        />
        <Stat label="Puntos de XP" value={formatXp(s.totalXp)} hint={<Link href="/panel/misiones" className="text-bronze">Ver misiones</Link>} />
        <div className="card">
          <p className="label">Nivel de rango</p>
          {s.level ? (
            <>
              <p className="font-display text-2xl">{s.level.name}</p>
              {s.nextLevel ? (
                <div className="mt-2 space-y-1">
                  <ProgressBar value={s.totalXp - s.level.minimum_xp} target={s.nextLevel.minimum_xp - s.level.minimum_xp} />
                  <p className="text-xs text-parchment">
                    {formatXp(s.nextLevel.minimum_xp - s.totalXp)} para {s.nextLevel.name}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-parchment">Rango máximo alcanzado</p>
              )}
            </>
          ) : (
            <>
              <p className="font-display text-2xl">—</p>
              <p className="mt-1 text-xs text-parchment">
                {s.levelsConfigured ? `Sin rango todavía${s.nextLevel ? `: ${formatXp(s.nextLevel.minimum_xp)} para ${s.nextLevel.name}` : ""}` : "Los rangos aún no están configurados"}
              </p>
            </>
          )}
        </div>
      </div>

      <section className="card mt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Gráfica de ventas</h2>
          <p className="text-xs text-parchment">Últimos 6 meses · ventas verificadas</p>
        </div>
        <SalesChart months={s.monthly} />
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="eyebrow mb-3">Licencia de tu tienda</h2>
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
              Tu tienda todavía no tiene una licencia activa. Gallo Negro revisa cada solicitud y activa la licencia
              después de formalizar el contrato y el pago.
              {user.role === "applicant" && (
                <Link href="/panel/solicitud" className="btn-bronze mt-4 flex w-full sm:inline-flex sm:w-auto">Ver o enviar mi solicitud</Link>
              )}
            </p>
          )}
        </section>

        <section className="card" id="datos-tienda">
          <h2 className="eyebrow mb-3">Datos de tu tienda</h2>
          <form action={updateStore} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="store_name">Nombre de tu tienda</label>
              <input className="input" id="store_name" name="store_name" defaultValue={user.storeName ?? ""} minLength={2} maxLength={60} placeholder="Ej.: Gallo Negro Valencia Centro" />
            </div>
            <div>
              <label className="label" htmlFor="full_name">Responsable de la tienda</label>
              <input className="input" id="full_name" name="full_name" defaultValue={user.fullName ?? ""} maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="public_alias">Nombre visible en rankings</label>
              <input className="input" id="public_alias" name="public_alias" defaultValue={user.publicAlias ?? ""} minLength={2} maxLength={40} />
            </div>
            <p className="text-xs text-parchment sm:col-span-2">El nombre visible es lo único que verán otras tiendas en rankings y comunidad.</p>
            <button className="btn-ghost sm:col-span-2 sm:justify-self-start">Guardar datos de la tienda</button>
          </form>
        </section>
      </div>
    </>
  );
}
