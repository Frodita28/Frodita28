"use client";

import { useRef, useState } from "react";
import { TEXTOS_CLASIFICACION as T } from "@/content/rangos";
import { updatePublicAlias } from "../actions";

/** «Tu nombre en el ranking»: muestra el nombre visible y permite cambiarlo en línea. */
export function NameEditor({ alias }: { alias: string | null }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="ui-card-inset" aria-labelledby="nombre-ranking">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="nombre-ranking" className="ui-label">{T.nombreTitulo}</h2>
          {!editing && (
            <p className="mt-1 truncate font-medium">
              {alias ?? <span className="text-fg-2">{T.nombrePorDefecto} (sin nombre visible)</span>}
            </p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            className="ui-btn-sm"
            onClick={() => {
              setEditing(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            Cambiar
          </button>
        )}
      </div>

      {editing && (
        <form action={updatePublicAlias} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start" onKeyDown={(e) => e.key === "Escape" && setEditing(false)}>
          <label htmlFor="public_alias" className="sr-only">{T.nombreTitulo}</label>
          <input
            ref={inputRef}
            id="public_alias"
            name="public_alias"
            className="ui-input sm:max-w-xs"
            defaultValue={alias ?? ""}
            maxLength={T.nombreMax}
            pattern={`.{${T.nombreMin},}`}
            title={`Entre ${T.nombreMin} y ${T.nombreMax} caracteres, o vacío`}
            placeholder={T.nombrePorDefecto}
            aria-describedby="nombre-ayuda"
          />
          <div className="flex gap-2">
            <button className="ui-btn-sm bg-accent! text-bg! hover:bg-accent/90!">Guardar</button>
            <button type="button" className="ui-btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </form>
      )}
      <p id="nombre-ayuda" className="mt-2 text-[13px] text-fg-2">{T.nombreAyuda}</p>
    </section>
  );
}
