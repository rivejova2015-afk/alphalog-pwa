import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TerminalReportsSchedulePanel } from "@/components/terminal/TerminalReportsSchedulePanel.client";

export const dynamic = "force-dynamic";

export default async function TerminalReportsSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#22d3ee]">Terminal</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <CalendarClock size={22} className="text-[#22d3ee]" />
          Reportes programados
        </h1>
        <p className="text-sm text-[#94a3b8]">
          Crea, lista y cancela jobs de reporte IA programados por QStash. Se ejecutan una sola vez
          en la hora elegida (zona Puerto Rico).
        </p>
      </header>

      <TerminalReportsSchedulePanel />
    </div>
  );
}
