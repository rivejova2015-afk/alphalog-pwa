import { Card } from '../shared/Card';
import Link from 'next/link';

export function SelectorDashboard() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[#e2e8f0] mb-4 font-mono">AlphaLog 2.1</h1>
        <p className="text-[#94a3b8] text-lg">Choose your dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {/* Intelligence Suite */}
        <Card hover className="flex flex-col">
          <div className="w-12 h-12 bg-[#22d3ee]/20 border border-[#22d3ee]/30 rounded-lg flex items-center justify-center mb-4">
            <span className="text-[#22d3ee] text-2xl">⚙️</span>
          </div>
          <h2 className="text-xl font-bold text-[#e2e8f0] mb-3">Intelligence Suite</h2>
          <p className="text-sm text-[#94a3b8] mb-4 flex-1">
            Agents dashboard · Algorithmic trading · Market intelligence · Signal hub
          </p>
          <Link href="/intelligence">
            <button className="w-full px-4 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] font-bold rounded transition-colors text-sm">
              ENTER
            </button>
          </Link>
        </Card>

        {/* Business */}
        <Card hover className="flex flex-col">
          <div className="w-12 h-12 bg-[#34d399]/20 border border-[#34d399]/30 rounded-lg flex items-center justify-center mb-4">
            <span className="text-[#34d399] text-2xl">📊</span>
          </div>
          <h2 className="text-xl font-bold text-[#e2e8f0] mb-3">Business</h2>
          <p className="text-sm text-[#94a3b8] mb-4 flex-1">
            Decisions · Journal · KPIs · SOPs
          </p>
          <Link href="/business">
            <button className="w-full px-4 py-2 bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] font-bold rounded transition-colors text-sm">
              ENTER
            </button>
          </Link>
        </Card>

        {/* Map Hot */}
        <Card hover className="flex flex-col">
          <div className="w-12 h-12 bg-[#eab308]/20 border border-[#eab308]/30 rounded-lg flex items-center justify-center mb-4">
            <span className="text-[#eab308] text-2xl">🎯</span>
          </div>
          <h2 className="text-xl font-bold text-[#e2e8f0] mb-3">Map Hot</h2>
          <p className="text-sm text-[#94a3b8] mb-4 flex-1">
            Goals tracking · Progress analysis · Future vision
          </p>
          <Link href="/map-hot">
            <button className="w-full px-4 py-2 bg-[#eab308] hover:bg-[#d99e08] text-[#0a0e1a] font-bold rounded transition-colors text-sm">
              ENTER
            </button>
          </Link>
        </Card>
      </div>

      {/* Quick Status Footer */}
      <Card className="text-center">
        <p className="text-sm text-[#94a3b8] mb-2">AlphaLog Status</p>
        <p className="text-lg font-bold font-mono text-[#22d3ee]">System Online</p>
      </Card>
    </div>
  );
}
