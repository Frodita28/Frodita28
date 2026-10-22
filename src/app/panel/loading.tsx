/** Esqueleto del panel de la tienda mientras el servidor prepara la sección. */
export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Cargando">
      <div className="slab mb-5 h-24 border-l-4 border-l-gold" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="slab h-36" />
        ))}
      </div>
      <div className="slab mt-5 h-48" />
    </div>
  );
}
