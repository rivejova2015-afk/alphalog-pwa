import Link from "next/link";
import {
  Scale, BookOpen, LineChart, ClipboardList, Activity, TrendingUp,
  Building2, MapPin, AlertCircle, CheckCircle2, Clock, DollarSign, Timer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loadOperationsDashboardData } from "@/lib/business/operationsDashboard";

export const dynamic = "force-dynamic";

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

function formatRunway(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return "—";
  if (months >= 99) return "99+ m";
  if (months >= 12) return `${(months / 12).toFixed(1)}y`;
  return `${months.toFixed(1)} m`;
}

export default async function OperationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const overview = await loadOperationsDashboardData(user.id);

  const pnlPositive = overview.netPnlMonth >= 0;
  const runwayHealthy = overview.runwayMonths >= 6;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">Business Hub</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Manage your trading business operations</p>
      </div>

      {/* Overview tiles — 6 KPIs per spec (decisions pending, SOPs to run, milestones, costs, PnL, runway) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile
          icon={Scale}
          label="Decisions pendientes"
          value={overview.decisionsPending.toString()}
          accent={overview.decisionsPending > 0 ? "#22d3ee" : "#34d399"}
          href="/business/decisions"
        />
        <Tile
          icon={ClipboardList}
          label="SOPs por correr"
          value={overview.sopsToRun.toString()}
          accent={overview.sopsToRun > 0 ? "#eab308" : "#34d399"}
          href="/business/sops"
        />
        <Tile
          icon={overview.milestonesPending > 0 ? Clock : CheckCircle2}
          label="Milestones pendientes"
          value={overview.milestonesPending.toString()}
          accent={overview.milestonesPending > 0 ? "#22d3ee" : "#34d399"}
          href="/business/roadmap"
        />
        <Tile
          icon={overview.costsTotalMonth > 0 ? AlertCircle : CheckCircle2}
          label="Costos del mes"
          value={`$${overview.costsTotalMonth.toFixed(0)}`}
          accent={overview.costsTotalMonth > 0 ? "#ef4444" : "#34d399"}
          href="/business/pl"
        />
        <Tile
          icon={DollarSign}
          label="P&L del mes"
          value={`${pnlPositive ? "+" : ""}$${overview.netPnlMonth.toFixed(0)}`}
          accent={pnlPositive ? "#34d399" : "#ef4444"}
          href="/business/pl"
        />
        <Tile
          icon={Timer}
          label="Runway"
          value={formatRunway(overview.runwayMonths)}
          accent={runwayHealthy ? "#34d399" : overview.runwayMonths >= 3 ? "#eab308" : "#ef4444"}
          href="/business/runway"
        />
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#94a3b8] mb-3">Módulos</h2>
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
    </div>
  );
}

function Tile({ icon: Icon, label, value, accent, href }: { icon: typeof Scale; label: string; value: string; accent: string; href: string }) {
  return (
    <Link href={href} className="block">
      <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 hover:bg-[#151b28] transition-colors">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} style={{ color: accent }} />
          <p className="text-[10px] uppercase tracking-wider text-[#475569]">{label}</p>
        </div>
        <p className="text-2xl font-bold font-mono" style={{ color: accent }}>{value}</p>
      </div>
    </Link>
  );
}
