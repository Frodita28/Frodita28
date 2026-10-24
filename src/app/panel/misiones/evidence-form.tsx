"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { submitEvidence } from "./actions";

type SendResult = { ok: true } | { ok: false; error: string };

function SubmitButton({ busy }: { busy?: boolean }) {
  const { pending } = useFormStatus();
  const loading = busy || pending;
  return (
    <button className="ui-btn-primary w-full sm:w-auto" disabled={loading} aria-busy={loading}>
      {loading ? "Enviando…" : "Enviar evidencia"}
    </button>
  );
}

/**
 * Formulario de evidencia de una misión (enlace o captura + nota). Lo usan /panel/misiones
 * (con redirección y mensaje en la URL) y el panel inferior de Tu tienda (con `onSend`,
 * que devuelve el resultado para mostrarlo en el mismo panel).
 */
export function EvidenceForm({
  participationId,
  returnTo = "/panel/misiones",
  onSend,
}: {
  participationId: string;
  returnTo?: string;
  onSend?: (formData: FormData) => Promise<SendResult>;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const id = (k: string) => `${k}-${participationId}`;

  return (
    <form
      action={onSend ? undefined : submitEvidence}
      onSubmit={
        onSend
          ? (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              setError(null);
              start(async () => {
                const r = await onSend(fd);
                if (!r.ok) setError(r.error);
              });
            }
          : undefined
      }
      className="max-w-2xl space-y-4"
    >
      <input type="hidden" name="participation_id" value={participationId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <div>
        <label className="ui-field-label" htmlFor={id("url")}>Enlace de la publicación</label>
        <input className="ui-input" id={id("url")} name="url" type="url" inputMode="url" autoComplete="off" placeholder="https://instagram.com/reel/…" />
      </div>
      <div>
        <label className="ui-field-label" htmlFor={id("file")}>…o captura (PNG, JPG, WEBP · máx. 5 MB)</label>
        <input
          className="block w-full text-[15px] text-fg-2 file:mr-3 file:min-h-11 file:rounded-ui file:border file:border-line file:bg-surface-2 file:px-4 file:text-fg"
          id={id("file")}
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
        />
      </div>
      <input className="ui-input" name="note" maxLength={1000} placeholder="Nota opcional para el revisor" aria-label="Nota opcional para el revisor" />
      <p className="text-[13px] text-fg-2">Nunca te pediremos contraseñas de tus redes sociales.</p>
      {error && (
        <p role="alert" className="rounded-ui border border-line border-l-4 border-l-brand-red bg-surface-2 p-3 text-[15px]">
          {error}
        </p>
      )}
      <SubmitButton busy={busy} />
    </form>
  );
}
