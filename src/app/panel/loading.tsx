/** Esqueleto del panel de la tienda mientras el servidor prepara la sección. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-12 motion-safe:animate-pulse" role="status" aria-label="Cargando">
      <div className="space-y-3 border-l-4 border-brand-red pl-4 sm:pl-6">
        <div className="h-10 w-64 max-w-full rounded-ui bg-surface-2" />
        <div className="h-4 w-full max-w-xl rounded-ui bg-surface" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="ui-card h-36" />
        ))}
      </div>
      <div className="ui-card h-48" />
    </div>
  );
}
