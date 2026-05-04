import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeworkList } from "@/components/securities/cybersec/HomeworkList.client";

export default async function HomeworkPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">Homework</h1>
        <p className="text-sm text-[#94a3b8]">10 entregas para reforzar lo aprendido en cada módulo.</p>
      </header>
      <HomeworkList />
    </div>
  );
}
