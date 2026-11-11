import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/** La portada pública se quitó: se entra directo a iniciar sesión (o al panel si ya hay sesión). */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "admin" ? "/admin" : "/panel");
}
