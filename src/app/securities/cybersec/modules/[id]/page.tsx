import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getModule } from "@/lib/securities/cybersec";
import { ModuleView } from "@/components/securities/cybersec/ModuleView.client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ModulePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { id } = await params;
  const moduleId = Number.parseInt(id, 10);
  if (!Number.isFinite(moduleId)) notFound();

  const mod = getModule(moduleId);
  if (!mod) notFound();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <ModuleView module={mod} />
    </div>
  );
}
