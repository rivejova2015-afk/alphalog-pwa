import { Target } from "lucide-react";
import { GoalGrid } from "@/components/map-hot/GoalGrid.client";

export default function GoalsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <Target size={22} className="text-[#eab308]" />
          Goals
        </h1>
        <p className="text-sm text-[#94a3b8] mt-1">Track your targets across all timeframes</p>
      </div>
      <GoalGrid />
    </div>
  );
}
