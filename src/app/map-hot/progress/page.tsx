import { TrendingUp } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgressDistributionDonut } from "@/components/map-hot/ProgressDistributionDonut";
import { ProgressTimeframeTable } from "@/components/map-hot/ProgressTimeframeTable";
import { AtRiskGoalsList } from "@/components/map-hot/AtRiskGoalsList";
import { GoalHistoryChart } from "@/components/map-hot/GoalHistoryChart.client";

type GoalRow = {
  id: string;
  name: string;
  timeframe: "annual" | "quarterly" | "monthly" | "weekly";
  target_value: string | number;
  current_value: string | number;
  unit: string;
  status: "ON_TRACK" | "BELOW_PACE" | "EXCEEDED" | "WARNING";
  due_date: string | null;
};

const toNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    redirect("/auth");
  }

  const { data: rows } = await supabase
    .from("map_hot_goals")
    .select("id, name, timeframe, target_value, current_value, unit, status, due_date")
    .eq("user_id", userData.user.id)
    .is("deleted_at", null);

  const goals = ((rows ?? []) as unknown as GoalRow[]).map((g) => ({
    id: g.id,
    name: g.name,
    timeframe: g.timeframe,
    target_value: toNumber(g.target_value),
    current_value: toNumber(g.current_value),
    unit: g.unit,
    status: g.status,
    due_date: g.due_date,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <TrendingUp size={22} className="text-[#22d3ee]" />
          Progress Map
        </h1>
        <p className="text-sm text-[#94a3b8] mt-1">Current snapshot across all goals</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ProgressDistributionDonut goals={goals} />
        <ProgressTimeframeTable goals={goals} />
      </div>

      <div className="mb-4">
        <GoalHistoryChart
          goals={goals.map((g) => ({
            id: g.id,
            name: g.name,
            target_value: g.target_value,
            unit: g.unit,
          }))}
        />
      </div>

      <AtRiskGoalsList goals={goals} />
    </div>
  );
}
