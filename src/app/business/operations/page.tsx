import Link from "next/link";
import { Scale, BookOpen, LineChart, ClipboardList, Activity, TrendingUp, Building2, MapPin } from "lucide-react";

const SECTIONS = [
  { label: "Decisions", href: "/business/decisions", icon: Scale, color: "#34d399", desc: "Strategic decisions and execution tracking" },
  { label: "Journal", href: "/business/journal", icon: BookOpen, color: "#c084fc", desc: "Trading reflections and analysis notes" },
  { label: "KPIs", href: "/business/kpis", icon: LineChart, color: "#60a5fa", desc: "Key performance indicators" },
  { label: "SOPs", href: "/business/sops", icon: ClipboardList, color: "#eab308", desc: "Standard operating procedures with checklists" },
  { label: "Health", href: "/business/health", icon: Activity, color: "#34d399", desc: "Business health overview" },
  { label: "P&L", href: "/business/pl", icon: TrendingUp, color: "#22d3ee", desc: "Profit and loss analysis" },
  { label: "LLC", href: "/business/llc", icon: Building2, color: "#94a3b8", desc: "Entity management and documents" },
  { label: "Roadmap", href: "/business/roadmap", icon: MapPin, color: "#c084fc", desc: "Product and business roadmap" },
];

export default function OperationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">Business Hub</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Manage your trading business operations</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {SECTIONS.map(({ label, href, icon: Icon, color, desc }) => (
          <Link key={href} href={href} className="block">
            <div className="bg-[#151b28] border border-[#1f2937] hover:border-[#2d3748] rounded-lg p-4 h-full transition-colors group">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <div className="text-sm font-bold text-[#e2e8f0] mb-1 group-hover:text-white transition-colors">{label}</div>
              <div className="text-xs text-[#475569]">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
