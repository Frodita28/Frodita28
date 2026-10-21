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
      footer={<>Las cuentas las asigna Gallo Negro. Si olvidaste tu contraseña, pide una nueva al administrador.</>}
    >
      <Flash ok={sp.ok} error={sp.error} />
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="label" htmlFor="username">Usuario</label>
          <input className="input" id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn-primary w-full">Entrar</button>
      </form>
    </AuthCard>
  );
}
