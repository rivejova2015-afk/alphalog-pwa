import { Rocket } from "lucide-react";
import { FutureProgressTracker } from "@/components/map-hot/FutureProgressTracker";

export default function PlanningPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <Rocket size={22} className="text-[#c084fc]" />
          Future Planning
        </h1>
        <p className="text-sm text-[#94a3b8] mt-1">Quarterly milestones and annual vision</p>
      </div>
      <FutureProgressTracker />
    </div>
  );
}
