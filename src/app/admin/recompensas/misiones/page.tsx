import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { formatNum } from "@/lib/gn";
import { createClient } from "@/lib/supabase/server";
import { setMissionGn } from "../actions";

export const metadata = { title: "Misiones GN · Admin" };

type M = { id: string; code: string; title: string; frequency: string; xp_reward: number; gn_reward: number; status: string };
const FREQ: Record<string, string> = { daily: "Diaria", weekly: "Semanal", monthly: "Mensual", special: "Especial" };

export default async function MisionesGnAdmin({ searchParams }: PageProps<"/admin/recompensas/misiones">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: tope }] = await Promise.all([
    supabase.from("missions").select("id, code, title, frequency, xp_reward, gn_reward, status").neq("status", "archived").order("code"),
    supabase.from("gn_config").select("value").eq("key", "gn_misiones_tope_diario").maybeSingle(),
  ]);
  const missions = (data ?? []) as M[];

  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Recompensas GN" title="GN por misión">
        Los XP de cada misión no cambian aquí. Los GN de misiones tienen un tope de {formatNum(Number(tope?.value ?? 20))} GN por
        día y licenciatario, y se liberan con la misma espera que las ventas. El cambio aplica a las participaciones abiertas.
      </PageTitle>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Código</th><th>Misión</th><th>Frecuencia</th><th className="text-right">XP</th><th>GN</th></tr></thead>
          <tbody>
            {missions.length === 0 && <tr><td colSpan={5} className="text-parchment">Sin misiones.</td></tr>}
            {missions.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{m.code}</td>
                <td>{m.title}</td>
                <td>{FREQ[m.frequency] ?? m.frequency}</td>
                <td className="text-right">{formatNum(m.xp_reward)}</td>
                <td>
                  <form action={setMissionGn} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <label className="sr-only" htmlFor={`gn-${m.id}`}>GN de {m.code}</label>
                    <input className="input w-24 text-base" id={`gn-${m.id}`} name="gn" type="number" min={0} max={10000} defaultValue={m.gn_reward} />
                    <button className="btn-ghost px-3 py-2 text-xs">Guardar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
