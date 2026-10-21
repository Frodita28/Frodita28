import { AppShell } from "@/components/nav";
import { requireUser } from "@/lib/auth";

const ROLE_LABEL = { applicant: "Solicitante", licensee: "Licenciado", admin: "Administrador" } as const;

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const items = [
    { href: "/panel", label: "Inicio" },
    { href: "/panel/misiones", label: "Misiones" },
    { href: "/panel/ventas", label: "Ventas" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Administración" }] : []),
  ];
  return (
    <AppShell items={items} userLabel={user.publicAlias ?? user.fullName ?? user.email ?? ""} roleLabel={ROLE_LABEL[user.role]}>
      {children}
    </AppShell>
  );
}
