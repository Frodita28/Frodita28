import { AppShell } from "@/components/nav";
import { requireUser } from "@/lib/auth";

const ROLE_LABEL = { applicant: "Solicitante", licensee: "Tienda licenciada", admin: "Administrador" } as const;

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const user = await requireUser();
  const items = [
    { href: "/panel", label: "Tu Tienda" },
    ...(user.role !== "admin" ? [{ href: "/panel/solicitud", label: "Mi solicitud" }] : []),
    { href: "/panel/misiones", label: "Misiones" },
    { href: "/panel/ventas", label: "Ventas" },
    { href: "/nueva-clave", label: "Contraseña" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Administración" }] : []),
  ];
  return (
    <AppShell items={items} userLabel={user.storeName ?? user.publicAlias ?? user.fullName ?? user.email ?? ""} roleLabel={ROLE_LABEL[user.role]}>
      {children}
    </AppShell>
  );
}
