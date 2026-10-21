import { AuthCard } from "@/components/auth-card";
import { Flash } from "@/components/flash";
import { requestPasswordReset } from "../login/actions";

export const metadata = { title: "Recuperar contraseña" };

export default async function RecoverPage({ searchParams }: PageProps<"/recuperar">) {
  const sp = await searchParams;
  return (
    <AuthCard title="Recuperar contraseña">
      <Flash ok={sp.ok} error={sp.error} />
      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <button className="btn-primary w-full">Enviar enlace</button>
      </form>
    </AuthCard>
  );
}
