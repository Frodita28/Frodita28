import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Flash } from "@/components/flash";
import { requireUser } from "@/lib/auth";
import { updatePassword } from "../login/actions";

export const metadata = { title: "Cambiar contraseña" };

export default async function NewPasswordPage({ searchParams }: PageProps<"/nueva-clave">) {
  await requireUser("/nueva-clave");
  const sp = await searchParams;
  return (
    <AuthCard title="Cambiar contraseña" footer={<Link className="text-bronze underline" href="/panel">Volver al panel</Link>}>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="mb-4 text-xs text-parchment">
        Si tu contraseña te la asignó el administrador, cámbiala por una propia de al menos 10 caracteres.
      </p>
      <form action={updatePassword} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">Nueva contraseña (mínimo 10 caracteres)</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </div>
        <button className="btn-primary w-full">Guardar</button>
      </form>
    </AuthCard>
  );
}
