/** Esqueleto de la clasificación: encabezado, podio de 3 columnas y lista. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-8 motion-safe:animate-pulse" role="status" aria-label="Cargando">
      <div className="space-y-3 ">
        <div className="h-10 w-64 max-w-full rounded-ui bg-surface-2" />
        <div className="h-4 w-full max-w-xl rounded-ui bg-surface" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-11 w-24 shrink-0 rounded-ui bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
        <div className="ui-card h-44 sm:h-64" />
        <div className="ui-card h-52 sm:h-80" />
        <div className="ui-card h-44 sm:h-64" />
      </div>
      <div className="divide-y divide-line rounded-ui border border-line bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 sm:px-6">
            <div className="h-4 w-8 rounded-ui bg-surface-2" />
            <div className="h-9 w-9 rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 max-w-full rounded-ui bg-surface-2" />
              <div className="h-1 w-32 rounded-ui bg-surface-2" />
            </div>
            <div className="h-4 w-16 rounded-ui bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
