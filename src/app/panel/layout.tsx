import { StoreShell } from "@/components/club";
import type { ClubTab } from "@/components/club-tabs";
import { requireUser } from "@/lib/auth";

const ROLE_LABEL = { applicant: "Solicitante", licensee: "Licenciatario oficial", admin: "Administrador" } as const;

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const items: ClubTab[] = [
    { href: "/panel", label: "Tu Tienda", icon: "store" },
    { href: "/panel/clasificacion", label: "Clasificación", icon: "podium" },
    { href: "/panel/recompensas", label: "Recompensas", icon: "gift" },
    { href: "/panel/misiones", label: "Misiones", icon: "flag" },
    { href: "/panel/ventas", label: "Ventas", icon: "qr" },
    { href: "/nueva-clave", label: "Contraseña", icon: "key" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Administración", icon: "gear" } as const] : []),
  ];
  return (
    <StoreShell tabs={items} storeName={user.storeName ?? user.publicAlias ?? user.fullName ?? "Tu Tienda"} roleLabel={ROLE_LABEL[user.role]}>
      {children}
    </StoreShell>
  );
}
