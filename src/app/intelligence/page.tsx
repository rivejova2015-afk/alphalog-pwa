import { Bot, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function IntelligencePage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-[#e2e8f0] mb-2 font-mono">Intelligence Suite</h1>
      <p className="text-[#94a3b8] mb-8">AI agents and algorithmic trading systems</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/intelligence/agents" className="block">
          <div className="bg-[#151b28] border border-[#1f2937] hover:border-[#22d3ee]/40 rounded-lg p-6 transition-colors group">
            <div className="w-10 h-10 bg-[#22d3ee]/10 border border-[#22d3ee]/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#22d3ee]/20 transition-colors">
              <Bot size={20} className="text-[#22d3ee]" />
            </div>
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-2">Agents Dashboard</h2>
            <p className="text-sm text-[#94a3b8]">AI agents monitoring, operations, and performance</p>
          </div>
        </Link>

        <Link href="/intelligence/algorithms" className="block">
          <div className="bg-[#151b28] border border-[#1f2937] hover:border-[#34d399]/40 rounded-lg p-6 transition-colors group">
            <div className="w-10 h-10 bg-[#34d399]/10 border border-[#34d399]/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#34d399]/20 transition-colors">
              <TrendingUp size={20} className="text-[#34d399]" />
            </div>
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-2">Algorithmic Trading</h2>
            <p className="text-sm text-[#94a3b8]">Forex and futures algorithm strategies, live P&L, and control</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
