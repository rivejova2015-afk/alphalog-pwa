import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConstraintMonitorData } from "@/lib/intelligence/metrics";
import { ConstraintMonitorPanel } from "@/components/intelligence/ConstraintMonitorPanel.client";

export const dynamic = "force-dynamic";

export default async function ConstraintMonitorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const data = await getConstraintMonitorData();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#eab308]">Intelligence</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <ShieldCheck size={22} className="text-[#eab308]" />
          Constraint Monitor
        </h1>
        <p className="text-sm text-[#94a3b8]">
          Semáforo de 4 disciplinas: cadencia, win rate, P&amp;L y journaling. Mantén todos en verde
          para sostener tu edge.
        </p>
      </header>

      <ConstraintMonitorPanel data={data} />
    </div>
  );
}
