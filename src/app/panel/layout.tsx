import { ROLE_LABEL, StoreShell, panelTabs } from "@/components/club";
import { requireUser } from "@/lib/auth";
import { getSharedRankLevel } from "@/lib/clan-server";
import { hayDiariasPendientes } from "@/lib/panel-nav";
import { getMyTotalXp } from "@/lib/xp";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const [totalXp, misionesPendientes, nivel] = await Promise.all([getMyTotalXp(user.id), hayDiariasPendientes(user.id), getSharedRankLevel()]);
  return (
    <StoreShell
      tabs={panelTabs(user.role)}
      storeName={user.storeName ?? user.publicAlias ?? user.fullName ?? "Tu Tienda"}
      roleLabel={ROLE_LABEL[user.role]}
      totalXp={totalXp}
      nivel={nivel}
      misionesPendientes={misionesPendientes}
      isAdmin={user.role === "admin"}
    >
      {children}
    </StoreShell>
  );
}
