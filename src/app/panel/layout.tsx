import { ROLE_LABEL, StoreShell, panelTabs } from "@/components/club";
import { noticeViews } from "@/components/gn";
import { requireUser } from "@/lib/auth";
import { getMyNotices, getSharedRankLevel } from "@/lib/clan-server";
import { getGnResumen, getRecompensasV3 } from "@/lib/gn-server";
import { hayDiariasPendientes } from "@/lib/panel-nav";
import { getMyTotalXp } from "@/lib/xp";

/** Saldo y avisos de GN para la cabecera, solo si el programa está activo para esta tienda. */
async function cabeceraGn(userId: string) {
  if (!(await getRecompensasV3())) return null;
  const [resumen, notices] = await Promise.all([getGnResumen(), getMyNotices(userId)]);
  return { available: resumen.debt > 0 ? 0 : resumen.available, notices: noticeViews(notices) };
}

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const [totalXp, misionesPendientes, nivel, gn] = await Promise.all([
    getMyTotalXp(user.id),
    hayDiariasPendientes(user.id),
    getSharedRankLevel(),
    cabeceraGn(user.id),
  ]);
  return (
    <StoreShell
      tabs={panelTabs(user.role)}
      storeName={user.storeName ?? user.publicAlias ?? user.fullName ?? "Tu Tienda"}
      roleLabel={ROLE_LABEL[user.role]}
      totalXp={totalXp}
      nivel={nivel}
      misionesPendientes={misionesPendientes}
      isAdmin={user.role === "admin"}
      gn={gn}
    >
      {children}
    </StoreShell>
  );
}
