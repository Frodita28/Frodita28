import { redirect } from "next/navigation";

/** Sección retirada del panel: los enlaces antiguos llevan a Perfil. */
export default function Page() {
  redirect("/panel");
}
