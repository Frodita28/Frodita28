import { ROLE_LABEL, StoreShell, panelTabs } from "@/components/club";
import { requireUser } from "@/lib/auth";
import { getMyTotalXp } from "@/lib/xp";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const totalXp = await getMyTotalXp(user.id);
  return (
    <StoreShell
      tabs={panelTabs(user.role)}
      storeName={user.storeName ?? user.publicAlias ?? user.fullName ?? "Tu Tienda"}
      roleLabel={ROLE_LABEL[user.role]}
      totalXp={totalXp}
    >
      {children}
    </StoreShell>
  );
}
