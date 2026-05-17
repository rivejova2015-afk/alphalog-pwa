import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMindOpsData } from "@/lib/intelligence/metrics";
import { MindOpsPanel } from "@/components/intelligence/MindOpsPanel.client";

export const dynamic = "force-dynamic";

export default async function MindOpsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const data = await getMindOpsData();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#34d399]">Intelligence</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <Brain size={22} className="text-[#34d399]" />
          MindOps
        </h1>
        <p className="text-sm text-[#94a3b8]">
          Correlación mood ↔ outcome de tu journal. Detecta sesgos emocionales que afectan tu trading.
        </p>
      </header>

      <MindOpsPanel data={data} />
    </div>
  );
}
