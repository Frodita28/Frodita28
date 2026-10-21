import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { Flash } from "@/components/flash";
import { signIn } from "./actions";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/panel";
  return (
    <AuthCard
      title="Iniciar sesión"
      footer={
        <>
          ¿Aún no tienes cuenta? <Link className="text-bronze underline" href="/registro">Regístrate</Link>
        </>
      }
    >
      <Flash ok={sp.ok} error={sp.error} />
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required minLength={10} />
        </div>
        <button className="btn-primary w-full">Entrar</button>
        <Link href="/recuperar" className="block text-center text-xs text-parchment underline">¿Olvidaste tu contraseña?</Link>
      </form>
    </AuthCard>
  );
}
