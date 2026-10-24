"use client";

import { useEffect, useId, useRef } from "react";
import { Icon } from "./icons";

/**
 * Panel inferior en el teléfono y ventana centrada en escritorio (desde 768 px), sobre <dialog>:
 * atrapa el foco, se cierra con Escape, con el botón visible de cerrar y al tocar fuera.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Un clic sobre el propio <dialog> (no sobre su contenido) es un toque fuera del panel.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="gn-sheet m-0 mt-auto w-full max-w-none overscroll-contain border-0 bg-transparent p-0 text-fg backdrop:bg-bg/80 md:m-auto md:w-[calc(100%-48px)] md:max-w-lg"
    >
      <div className="flex max-h-[85dvh] flex-col rounded-t-[12px] border border-b-0 border-line bg-surface pb-[env(safe-area-inset-bottom)] md:max-h-[80dvh] md:rounded-ui md:border-b md:pb-0">
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2 md:px-6">
          <h2 id={titleId} className="ui-title-card min-w-0 truncate">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-ui text-fg-2 hover:bg-surface-2 hover:text-fg">
            <Icon name="close" className="h-5 w-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-6">{children}</div>
      </div>
    </dialog>
  );
}
