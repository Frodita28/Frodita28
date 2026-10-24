"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";

/** Buscador de la clasificación: en el teléfono se pliega a un icono y se despliega al tocarlo. */
export function SearchToggle({ q, liga, top }: { q: string; liga: string; top: number | null }) {
  const [open, setOpen] = useState(Boolean(q));
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {!open && (
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-ui border border-line text-fg-2 hover:border-fg-2 hover:text-fg md:hidden"
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          aria-label="Buscar tienda"
        >
          <Icon name="search" className="h-5 w-5" />
        </button>
      )}
      <form className={`relative w-full lg:w-72 ${open ? "" : "max-md:hidden"}`} role="search">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-2" />
        <label htmlFor="q" className="sr-only">Buscar tienda</label>
        <input
          ref={inputRef}
          id="q"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          defaultValue={q}
          className="ui-input pl-9"
          placeholder="Buscar tienda…"
          onBlur={(e) => !e.currentTarget.value && setOpen(false)}
        />
        {liga && <input type="hidden" name="liga" value={liga} />}
        {top !== null && <input type="hidden" name="top" value={top} />}
      </form>
    </>
  );
}
