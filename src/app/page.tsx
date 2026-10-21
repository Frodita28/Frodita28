import Link from "next/link";
import { RoosterMark } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("license_plans").select("id, name, description, price, currency, status, is_demo").order("sort_order");
  return (
    <main className="flex-1">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center">
        <RoosterMark className="mb-6 h-16 w-16 text-bronze" />
        <p className="eyebrow mb-3">Gallo Negro Licencias · desde 2017</p>
        <h1 className="font-display text-4xl uppercase leading-tight sm:text-6xl">Ropa exclusiva con identidad propia</h1>
        <p className="mt-4 max-w-2xl text-linen">
          Una red de licenciados que comercializan Gallo Negro con disciplina, autenticidad y arte urbano independiente.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/registro" className="btn-bronze">Crear cuenta</Link>
          <Link href="/login" className="btn-ghost">Iniciar sesión</Link>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <h2 className="eyebrow mb-4 text-center">Planes de licencia</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(plans ?? []).map((p) => (
            <div key={p.id} className="card">
              <h3 className="font-display text-lg uppercase">{p.name}</h3>
              <p className="mt-2 text-sm text-linen">{p.description}</p>
              <p className="mt-4 text-sm">{p.price != null && p.status === "active" ? `${p.price} ${p.currency ?? ""}` : "Condiciones pendientes de confirmación"}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-parchment">
          Una licencia no garantiza ganancias. Precios, territorios, exclusividad y beneficios se definen por contrato.
        </p>
      </section>
    </main>
  );
}
