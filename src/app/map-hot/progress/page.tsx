import { TrendingUp } from "lucide-react";

export default function ProgressPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2 mb-6">
        <TrendingUp size={22} className="text-[#22d3ee]" />
        Progress Map
      </h1>
      <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-8 text-center">
        <TrendingUp className="w-12 h-12 text-[#22d3ee]/30 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-[#e2e8f0] mb-2">Progress Analysis</h2>
        <p className="text-sm text-[#94a3b8]">Detailed progress tracking and analysis coming in Week 6.</p>
      </div>
    </div>
  );
}
