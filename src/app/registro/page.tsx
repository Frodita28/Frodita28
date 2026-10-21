import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Flash } from "@/components/flash";
import { signUp } from "../login/actions";

export const metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: PageProps<"/registro">) {
  const sp = await searchParams;
  return (
    <AuthCard
      title="Crear cuenta"
      footer={
        <>
          ¿Ya tienes cuenta? <Link className="text-bronze underline" href="/login">Inicia sesión</Link>
        </>
      }
    >
      <Flash ok={sp.ok} error={sp.error} />
      <p className="mb-4 text-xs text-parchment">
        Crear una cuenta no equivale a tener una licencia. Gallo Negro revisa cada solicitud y activa la licencia
        tras formalizar el contrato.
      </p>
      <form action={signUp} className="space-y-4">
        <div>
          <label className="label" htmlFor="full_name">Nombre completo</label>
          <input className="input" id="full_name" name="full_name" autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña (mínimo 10 caracteres)</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </div>
        <button className="btn-primary w-full">Crear cuenta</button>
      </form>
    </AuthCard>
  );
}
