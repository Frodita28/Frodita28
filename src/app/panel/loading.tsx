/** Esqueleto del panel de la tienda mientras el servidor prepara la sección: hero de rango, misiones y cifras. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-12 motion-safe:animate-pulse" role="status" aria-label="Cargando">
      <div className="space-y-3 ">
        <div className="h-10 w-64 max-w-full rounded-ui bg-surface-2" />
        <div className="h-4 w-full max-w-xl rounded-ui bg-surface" />
      </div>
      {/* Hero de rango: anillo y datos. */}
      <div className="ui-card flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
        <div className="h-[212px] w-[212px] shrink-0 rounded-full border-[10px] border-surface-2 sm:h-80 sm:w-80" />
        <div className="flex w-full flex-col items-center gap-4 sm:items-start">
          <div className="h-3 w-28 rounded-ui bg-surface-2" />
          <div className="h-12 w-48 rounded-ui bg-surface-2" />
          <div className="grid w-full max-w-md grid-cols-2 gap-4">
            <div className="h-20 rounded-ui bg-surface-2" />
            <div className="h-20 rounded-ui bg-surface-2" />
          </div>
        </div>
      </div>
      {/* Misiones de hoy. */}
      <div className="grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-6">
        <div className="ui-card space-y-4">
          <div className="h-7 w-48 rounded-ui bg-surface-2" />
          <div className="h-12 rounded-ui bg-surface-2" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-surface-2" />
              <div className="h-10 flex-1 rounded-ui bg-surface-2" />
            </div>
          ))}
        </div>
        <div className="ui-card h-56" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="ui-card h-32" />
        ))}
      </div>
    </div>
  );
}
