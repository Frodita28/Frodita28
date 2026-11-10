import { Badge, ComingSoon, PageBanner } from "@/components/ui";
/** Tienda Clan anterior (se muestra mientras RECOMPENSAS_V3_ACTIVA está apagado): escaparate de productos para vender. Aún no hay productos publicados. */
export function TiendaClanLegacy() {
  return (
    <>
      <PageBanner title="Tienda Clan" aside={<Badge>Próximamente</Badge>}>
        Aquí verás los productos Gallo Negro disponibles para vender en tu tienda.
      </PageBanner>
      <ComingSoon title="Productos">
        Todavía no hay productos publicados. Cuando Gallo Negro los agregue, aparecerán en esta sección.
      </ComingSoon>
    </>
  );
}
