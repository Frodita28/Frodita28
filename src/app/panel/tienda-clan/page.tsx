import { Badge, ComingSoon, PageBanner } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Tienda Clan" };

/** Tienda Clan: escaparate de productos para vender. Aún no hay productos publicados. */
export default async function TiendaClanPage() {
  await requireUser("/panel/tienda-clan");
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
