import { ROLE_LABEL, StoreShell, panelTabs } from "@/components/club";
import { Flash } from "@/components/flash";
import { PageBanner } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { hayDiariasPendientes } from "@/lib/panel-nav";
import { getMyTotalXp } from "@/lib/xp";
import { updatePassword } from "../login/actions";

export const metadata = { title: "Cambiar contraseña" };

/**
 * Cambio de contraseña, enlazado desde el botón «Cambiar contraseña» de la cabecera del panel
 * (no es una pestaña). Misma estructura y pestañas que el resto de secciones.
 */
export default async function NewPasswordPage({ searchParams }: PageProps<"/nueva-clave">) {
  const user = await requireUser("/nueva-clave");
  const [sp, totalXp, misionesPendientes] = await Promise.all([searchParams, getMyTotalXp(user.id), hayDiariasPendientes(user.id)]);
  return (
    <StoreShell
      tabs={panelTabs(user.role)}
      storeName={user.storeName ?? user.publicAlias ?? user.fullName ?? "Tu Tienda"}
      roleLabel={ROLE_LABEL[user.role]}
      totalXp={totalXp}
      misionesPendientes={misionesPendientes}
      isAdmin={user.role === "admin"}
    >
      <div className="flex flex-col gap-4">
        <Flash ok={sp.ok} error={sp.error} variant="panel" />
        <PageBanner title="Cambiar contraseña">
          Si tu contraseña te la asignó el administrador, cámbiala por una propia de al menos 10 caracteres.
        </PageBanner>
      </div>
      <section className="ui-card w-full max-w-md">
        <form action={updatePassword} className="space-y-4">
          <div>
            <label className="ui-field-label" htmlFor="password">Nueva contraseña (mínimo 10 caracteres)</label>
            <input className="ui-input" id="password" name="password" type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} required minLength={10} />
          </div>
          <button className="ui-btn-primary w-full">Guardar</button>
        </form>
      </section>
    </StoreShell>
  );
}
