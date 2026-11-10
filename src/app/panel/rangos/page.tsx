import { PageBanner } from "@/components/ui";
import { RankCompact } from "@/components/rank-compact";
import { RankRoute } from "@/components/rank-route";
import { RankUnlocks } from "@/components/rank-unlocks";
import { requireUser } from "@/lib/auth";
import { getSharedRankLevel } from "@/lib/clan-server";
import { estadoRango } from "@/lib/rangos";
import { getMyTotalXp } from "@/lib/xp";

export const metadata = { title: "Ruta de rangos" };

/** Ruta de rangos: los cinco rangos y lo que libera cada uno (antes estaba plegada en Perfil). */
export default async function RangosPage() {
  const user = await requireUser("/panel/rangos");
  const [totalXp, compartido] = await Promise.all([getMyTotalXp(user.id), getSharedRankLevel()]);
  const nivel = estadoRango(totalXp, undefined, compartido).rango.nivel;
  return (
    <>
      <PageBanner title="Ruta de rangos">
        {compartido !== null ? "Tu rango sube con XP, ventas verificadas y requisitos de identidad, y nunca baja." : "Tu rango sube con los XP que ganas en las misiones."}
      </PageBanner>
      <div className="flex flex-col gap-4 sm:gap-6">
        <RankCompact totalXp={totalXp} nivel={compartido} />
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
          <RankRoute nivelActual={nivel} />
          <RankUnlocks nivelActual={nivel} />
        </div>
      </div>
    </>
  );
}
