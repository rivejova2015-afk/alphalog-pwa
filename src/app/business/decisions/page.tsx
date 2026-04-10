import { Scale, Plus } from "lucide-react";
import { DecisionsTimeline } from "@/components/business/decisions/DecisionsTimeline";

export default function DecisionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <Scale size={22} className="text-[#34d399]" />
            Decisions
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Strategic decisions and execution tracking</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] text-sm font-bold rounded transition-colors">
          <Plus size={16} />
          New Decision
        </button>
      </div>
      <DecisionsTimeline />
    </div>
  );
}
