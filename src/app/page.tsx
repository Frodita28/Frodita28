import Link from "next/link";
import { Logo, RoosterMark } from "@/components/brand";
import { PlanCard, PUBLIC_PLAN_COLUMNS, type PublicPlan } from "@/components/plan-card";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const VALUES = ["Exclusividad", "Identidad propia", "Disciplina", "Fuerza", "Autenticidad", "Arte urbano independiente", "Cultura deportiva"];

const STEPS = [
  ["Conoce los planes", "Revisa los planes y sus condiciones publicadas. Lo que aún no está confirmado aparece como pendiente."],
  ["Envía tu solicitud", "Escríbenos: Gallo Negro te asigna un usuario y en tu panel nos cuentas dónde estás, tu experiencia y por qué canales vendes."],
  ["Revisión del equipo", "Gallo Negro revisa cada solicitud. Puede pedirte información adicional antes de decidir."],
  ["Contrato y pago", "Si se aprueba, se formalizan por escrito las condiciones del plan, el contrato y el pago."],
  ["Activación", "Solo después el equipo activa tu licencia. Una solicitud aprobada todavía no es una licencia."],
  ["Tu panel privado", "Accedes a tu panel privado para registrar tus ventas y seguir tus misiones."],
] as const;

const CATEGORIES = ["Polos y camisetas", "Poleras y hoodies", "Gorras", "Shorts"];

const FAQ = [
  [
    "¿Qué es una licencia Gallo Negro?",
    "Es una autorización para comercializar productos oficiales de Gallo Negro bajo las condiciones de un contrato: plan, territorio, duración y productos autorizados.",
  ],
  [
    "¿Cuánto cuesta una licencia?",
    "Los precios y condiciones de cada plan se publican en esta página cuando Gallo Negro los confirma. Mientras un plan aparezca como pendiente, no hay precio vigente.",
  ],
  [
    "¿Enviar una solicitud me convierte en licenciado?",
    "No. La solicitud se revisa, y si se aprueba se formaliza el contrato y el pago. La licencia se activa después, como un paso aparte.",
  ],
  [
    "¿La licencia garantiza ganancias?",
    "No. Los resultados dependen de tus ventas reales, tus costos y tus gastos. Una licencia no es una inversión con rentabilidad garantizada.",
  ],
  [
    "¿Hay comisiones por invitar a otras personas?",
    "No. El modelo se basa en la venta real de productos. No existen comisiones por reclutar personas ni estructuras multinivel.",
  ],
  [
    "¿La licencia es exclusiva?",
    "La exclusividad, el territorio, la duración y la renovación se definen por contrato para cada licencia. No se anuncia ninguna exclusividad antes de que esté escrita.",
  ],
  [
    "¿Desde dónde puedo solicitar?",
    "El mercado inicial es Venezuela, con expansión progresiva a otros países de Latinoamérica. Indica tu país y ciudad en la solicitud.",
  ],
  [
    "¿Cómo sé en qué va mi solicitud?",
    "En tu panel verás si está pendiente, en revisión, si requiere información, si fue aprobada o rechazada, con los mensajes del equipo.",
  ],
  [
    "¿Qué datos me piden?",
    "Nombre, teléfono, país, ciudad, tu experiencia y tus canales de venta. Nunca pedimos contraseñas de redes sociales ni datos de tarjetas.",
  ],
] as const;

function contactLinks() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const whatsapp = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.replace(/[^0-9]/g, "");
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  return [
    email && { href: `mailto:${email}`, label: email },
    whatsapp && { href: `https://wa.me/${whatsapp}`, label: "WhatsApp" },
    instagram?.startsWith("https://") && { href: instagram, label: "Instagram" },
  ].filter((l): l is { href: string; label: string } => Boolean(l));
}

export default async function Home() {
  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([
    supabase.from("license_plans").select(PUBLIC_PLAN_COLUMNS).neq("status", "inactive").order("sort_order"),
    getCurrentUser(),
  ]);
  const plans = (data ?? []) as unknown as PublicPlan[];
  const contacts = contactLinks();
  const portal = user ? { href: user.role === "admin" ? "/admin" : "/panel", label: "Ir a mi panel" } : { href: "/login", label: "Portal de licenciados" };

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-ash bg-obsidian/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1 text-sm" aria-label="Principal">
            <a href="#planes" className="hidden rounded-md px-3 py-1.5 text-linen hover:text-ivory sm:inline">Planes</a>
            <a href="#preguntas" className="hidden rounded-md px-3 py-1.5 text-linen hover:text-ivory sm:inline">Preguntas</a>
            <Link href={portal.href} className="btn-ghost px-3 py-1.5 text-xs">{portal.label}</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-ash">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center sm:py-24">
            <RoosterMark className="mb-6 h-16 w-16 text-bronze" />
            <p className="eyebrow mb-3">Gallo Negro Licencias · desde 2017</p>
            <h1 className="font-display text-4xl uppercase leading-tight sm:text-6xl">Ropa exclusiva con identidad propia</h1>
            <p className="mt-5 max-w-2xl text-linen">
              Buscamos emprendedores, deportistas y creadores que quieran comercializar Gallo Negro con disciplina y
              autenticidad, dentro de una red de licenciados organizada y transparente.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              {/* Sin registro público: los visitantes piden su cuenta por contacto; quien ya tiene una solicita desde su panel. */}
              {user ? (
                <Link href="/panel/solicitud" className="btn-bronze px-6 py-3">Solicitar licencia</Link>
              ) : (
                <a href="#contacto" className="btn-bronze px-6 py-3">Solicitar licencia</a>
              )}
              <a href="#planes" className="btn-ghost px-6 py-3">Ver planes</a>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-16 md:grid-cols-2" aria-labelledby="marca">
          <div>
            <p className="eyebrow mb-2">La marca</p>
            <h2 id="marca" className="font-display text-2xl uppercase sm:text-3xl">Arte urbano, disciplina y fuerza</h2>
          </div>
          <div className="space-y-4 text-linen">
            <p>
              Gallo Negro nace en 2017 como una marca de ropa independiente, artística, urbana y deportiva. Su símbolo es
              el Ayam Cemani, el gallo completamente negro: fuerza, autenticidad y protección ancestral.
            </p>
            <p>
              Hoy la marca abre una nueva etapa: una red de licenciados que la lleven a más personas y ciudades, con
              herramientas profesionales y reglas claras.
            </p>
            <ul className="flex flex-wrap gap-2 pt-2">
              {VALUES.map((v) => (
                <li key={v} className="rounded-full border border-smoke px-3 py-1 text-xs uppercase tracking-wider text-parchment">{v}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-y border-ash bg-coal/60" aria-labelledby="modelo">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <p className="eyebrow mb-2">El modelo de licencias</p>
            <h2 id="modelo" className="font-display text-2xl uppercase sm:text-3xl">Cómo funciona</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="card">
                  <span className="font-display text-2xl text-bronze">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-semibold uppercase tracking-wide">{title}</h3>
                  <p className="mt-1 text-sm text-linen">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <p className="label">Productos que se comercializan</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => <li key={c} className="rounded-md bg-ash px-3 py-1.5 text-sm">{c}</li>)}
              </ul>
              <p className="mt-2 text-xs text-parchment">El catálogo detallado y los precios autorizados se comparten solo con licenciados.</p>
            </div>
          </div>
        </section>

        <section id="planes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16" aria-labelledby="planes-title">
          <p className="eyebrow mb-2 text-center">Planes de licencia</p>
          <h2 id="planes-title" className="text-center font-display text-2xl uppercase sm:text-3xl">Elige cómo empezar</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-linen">
            Las condiciones de cada plan se publican cuando Gallo Negro las confirma. Lo marcado como pendiente es
            provisional y no constituye una oferta.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => <PlanCard key={p.id} plan={p} />)}
            {plans.length === 0 && <p className="text-center text-sm text-parchment sm:col-span-2 lg:col-span-4">Los planes se publicarán próximamente.</p>}
          </div>
          <div className="mt-8 text-center">
            <Link href="/panel/solicitud" className="btn-bronze px-6 py-3">Enviar mi solicitud</Link>
          </div>
        </section>

        <section className="border-y border-ash bg-coal/60" aria-labelledby="transparencia">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 md:grid-cols-3">
            <h2 id="transparencia" className="font-display text-xl uppercase md:col-span-1">Reglas claras</h2>
            <ul className="space-y-2 text-sm text-linen md:col-span-2">
              <li>Una licencia no garantiza ganancias ni es una inversión con rentabilidad asegurada.</li>
              <li>No hay comisiones por reclutar personas: el foco es la venta real de productos.</li>
              <li>Precios, territorio, exclusividad, duración y beneficios se definen por contrato.</li>
              <li>Una solicitud, incluso aprobada, no es una licencia hasta que el equipo la activa.</li>
            </ul>
          </div>
        </section>

        <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16" aria-labelledby="faq">
          <p className="eyebrow mb-2">Preguntas frecuentes</p>
          <h2 id="faq" className="font-display text-2xl uppercase sm:text-3xl">Antes de solicitar</h2>
          <div className="mt-6 divide-y divide-ash rounded-xl border border-ash">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {q}
                  <span className="text-bronze transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 text-sm text-linen">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-ash" aria-labelledby="contacto">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-14 text-center">
            <h2 id="contacto" className="font-display text-xl uppercase">Contacto</h2>
            <p className="mt-3 max-w-md text-sm text-linen">
              Las cuentas del portal las asigna Gallo Negro. Escríbenos para solicitar tu licencia y recibir tu usuario.
            </p>
            {contacts.length > 0 ? (
              <ul className="mt-4 flex flex-wrap justify-center gap-3">
                {contacts.map((c) => <li key={c.href}><a className="btn-ghost" href={c.href}>{c.label}</a></li>)}
              </ul>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="border-t border-ash px-4 py-6 text-center text-xs text-parchment">
        Gallo Negro · Ropa exclusiva con identidad propia · desde 2017
      </footer>
    </div>
  );
}
