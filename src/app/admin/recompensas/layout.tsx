import { RecompensasNav } from "./subnav";

export default function RecompensasAdminLayout({ children }: LayoutProps<"/admin/recompensas">) {
  return (
    <>
      <RecompensasNav />
      {children}
    </>
  );
}
