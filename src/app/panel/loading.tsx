/** Esqueleto de Perfil mientras el servidor prepara la sección: indicadores, ventas, rango y acordeones. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 motion-safe:animate-pulse" role="status" aria-label="Cargando">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xl space-y-3">
          <div className="h-10 w-64 max-w-full rounded-ui bg-surface-2" />
          <div className="h-4 w-full rounded-ui bg-surface" />
        </div>
        <div className="h-14 w-full rounded-ui bg-surface-2 sm:w-64" />
      </div>
      {/* Indicadores del negocio. */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="ui-card h-28" />
        ))}
      </div>
      {/* Ventas y rango. */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="ui-card h-64" />
        <div className="ui-card h-40" />
      </div>
      <div className="ui-card h-14" />
      <div className="ui-card h-14" />
    </div>
  );
}
