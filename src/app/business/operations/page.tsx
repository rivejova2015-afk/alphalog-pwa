import Link from "next/link";
import {
  Scale, BookOpen, LineChart, ClipboardList, Activity, TrendingUp,
  Building2, MapPin, AlertCircle, CheckCircle2, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

// Lightweight aggregator that sums a few counters without pulling whole tables.
// Each query uses `head: true, count: 'exact'` so we transfer 0 bytes of rows.
async function loadOperationsOverview(userId: string) {
  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [decisionsCount, sopsCount, milestonesPending, costsThisMonth] = await Promise.all([
    supabase.from("business_decisions").select("id", { head: true, count: "exact" }).eq("user_id", userId).is("deleted_at", null),
    supabase.from("business_sops").select("id", { head: true, count: "exact" }).eq("user_id", userId).is("deleted_at", null),
    supabase.from("business_milestones").select("id", { head: true, count: "exact" }).eq("user_id", userId).is("deleted_at", null).neq("status", "completed"),
    supabase.from("business_costs").select("amount").eq("user_id", userId).is("deleted_at", null).gte("cost_date", startOfMonth.toISOString().split("T")[0]),
  ]);

  const costsTotalMonth = (costsThisMonth.data ?? []).reduce(
    (acc, row) => acc + Number((row as { amount: number | null }).amount ?? 0),
    0,
  );

  return {
    decisionsCount: decisionsCount.count ?? 0,
    sopsCount: sopsCount.count ?? 0,
    milestonesPending: milestonesPending.count ?? 0,
    costsTotalMonth,
  };
}

export default async function OperationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const overview = await loadOperationsOverview(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono">Business Hub</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Manage your trading business operations</p>
      </div>

      {/* Overview tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile
          icon={Scale}
          label="Active decisions"
          value={overview.decisionsCount.toString()}
          accent="#34d399"
          href="/business/decisions"
        />
        <Tile
          icon={ClipboardList}
          label="SOPs disponibles"
          value={overview.sopsCount.toString()}
          accent="#eab308"
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
