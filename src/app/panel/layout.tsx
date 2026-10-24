import { ROLE_LABEL, StoreShell, panelTabs } from "@/components/club";
import { requireUser } from "@/lib/auth";
import { hayDiariasPendientes } from "@/lib/panel-nav";
import { getMyTotalXp } from "@/lib/xp";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const [totalXp, misionesPendientes] = await Promise.all([getMyTotalXp(user.id), hayDiariasPendientes(user.id)]);
  return (
    <StoreShell
      tabs={panelTabs(user.role)}
      storeName={user.storeName ?? user.publicAlias ?? user.fullName ?? "Tu Tienda"}
      roleLabel={ROLE_LABEL[user.role]}
      totalXp={totalXp}
      misionesPendientes={misionesPendientes}
      isAdmin={user.role === "admin"}
    >
      {children}
    </StoreShell>
  );
}
