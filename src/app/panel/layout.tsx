import { ROLE_LABEL, StoreShell, panelTabs } from "@/components/club";
import { requireUser } from "@/lib/auth";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  return (
    <StoreShell tabs={panelTabs(user.role)} storeName={user.storeName ?? user.publicAlias ?? user.fullName ?? "Tu Tienda"} roleLabel={ROLE_LABEL[user.role]}>
      {children}
    </StoreShell>
  );
}
