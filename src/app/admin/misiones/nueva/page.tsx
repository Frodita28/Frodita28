import { Flash } from "@/components/flash";
import { PageTitle } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { MissionForm } from "../mission-form";

export const metadata = { title: "Nueva misión" };

export default async function NewMission({ searchParams }: PageProps<"/admin/misiones/nueva">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: plans }, { data: categories }] = await Promise.all([
    supabase.from("license_plans").select("id, name, is_demo").order("sort_order"),
    supabase.from("product_categories").select("slug, name").order("sort_order"),
  ]);
  return (
    <>
      <Flash ok={sp.ok} error={sp.error} />
      <PageTitle eyebrow="Misiones" title="Nueva misión" />
      <MissionForm plans={plans ?? []} categories={categories ?? []} />
    </>
  );
}
