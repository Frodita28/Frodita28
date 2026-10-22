"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn-bronze" onClick={() => window.print()}>
      Imprimir etiquetas
    </button>
  );
}
