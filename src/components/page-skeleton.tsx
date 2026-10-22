/** Esqueleto que se muestra al instante mientras el servidor prepara la página. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse" role="status" aria-label="Cargando">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 rounded bg-ash" />
        <div className="h-8 w-56 rounded bg-ash" />
        <div className="h-3 w-full max-w-xl rounded bg-ash/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card h-20" />
        ))}
      </div>
      <div className="card mt-4 h-48" />
    </div>
  );
}
