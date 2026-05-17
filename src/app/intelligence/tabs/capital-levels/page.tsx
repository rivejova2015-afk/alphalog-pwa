import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCapitalLevelsData } from "@/lib/intelligence/metrics";
import { CapitalLevelsPanel } from "@/components/intelligence/CapitalLevelsPanel.client";

export const dynamic = "force-dynamic";

export default async function CapitalLevelsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const data = await getCapitalLevelsData();

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#22d3ee]">Intelligence</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <TrendingUp size={22} className="text-[#22d3ee]" />
          Capital Levels
        </h1>
        <p className="text-sm text-[#94a3b8]">
          Distribución de capital entre cuentas reales y propfirm, performance 30d y top cuentas.
        </p>
      </header>

      <CapitalLevelsPanel data={data} />
    </div>
  );
}
