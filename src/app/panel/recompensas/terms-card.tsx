"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TEXTOS_CLAN as T, TEXTOS_RECOMPENSAS as R } from "@/content/recompensas";
import { acceptTerms } from "../tienda-clan/actions";

/** Términos de GN: se aceptan una vez por versión y son obligatorios para canjear. */
export function TermsCard({
  terms,
  acceptedAt,
}: {
  terms: { version: number; clauses: string[]; isDraft: boolean; accepted: boolean };
  acceptedAt: string | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState(false);

  if (terms.accepted) {
    return (
      <details className="ui-card">
        <summary className="flex min-h-11 cursor-pointer items-center text-[15px] text-fg-2">
          {acceptedAt ? R.aceptados(terms.version, acceptedAt) : T.terminosTitulo}
        </summary>
        <Clausulas terms={terms} />
      </details>
    );
  }

  return (
    <section className="ui-card flex flex-col gap-3 border-gold/60" aria-labelledby="terminos-titulo">
      <h2 id="terminos-titulo" className="ui-title-section">
        {T.terminosTitulo} · v{terms.version}
      </h2>
      <p className="text-[15px]">{R.terminosPendientes}</p>
      {terms.isDraft && <p className="text-[13px] text-fg-2">{R.borrador}</p>}
      <Clausulas terms={terms} />
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        {T.aceptar}
      </label>
      {error && <p role="alert" className="text-[15px]">{error}</p>}
      <button
        type="button"
        className="ui-btn-primary w-full sm:w-auto sm:self-start"
        disabled={!check || busy}
        onClick={() =>
          start(async () => {
            const res = await acceptTerms(terms.version);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        Aceptar términos
      </button>
    </section>
  );
}

function Clausulas({ terms }: { terms: { clauses: string[] } }) {
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-fg-2">
      {terms.clauses.map((c, i) => (
        <li key={i}>{c}</li>
      ))}
    </ol>
  );
}
