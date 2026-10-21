import { AppShell } from "@/components/nav";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const items = [
    { href: "/admin", label: "Resumen" },
    { href: "/admin/misiones", label: "Misiones" },
    { href: "/admin/revisiones", label: "Evidencias" },
    { href: "/admin/ventas", label: "Ventas" },
    { href: "/admin/licencias", label: "Licencias" },
    { href: "/admin/xp", label: "XP y alertas" },
    { href: "/admin/auditoria", label: "Auditoría" },
    { href: "/panel", label: "Volver al panel" },
  ];
  return (
    <AppShell items={items} userLabel={user.fullName ?? user.email ?? ""} roleLabel="Administrador">
      {children}
    </AppShell>
  );
}
