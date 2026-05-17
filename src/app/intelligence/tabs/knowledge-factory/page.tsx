import { redirect } from "next/navigation";
import { BookOpenCheck, FileText, NotebookPen, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getKnowledgeFactoryData } from "@/lib/intelligence/metrics";
import KnowledgeFactorySynthesis from "@/components/intelligence/KnowledgeFactorySynthesis.client";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  weekly_report:   "Weekly Report",
  trade_evidence:  "Trade Evidence",
  terminal_report: "Terminal Report",
  journal:         "Journal",
};

export default async function KnowledgeFactoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const data = await getKnowledgeFactoryData();

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#a78bfa]">Intelligence</p>
        <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
          <Sparkles size={22} className="text-[#a78bfa]" />
          Knowledge Factory
        </h1>
        <p className="text-sm text-[#94a3b8]">
          Sintetiza tus aprendizajes del último mes con IA. Combina weekly reports, evidencia de trades,
          análisis del terminal y lecciones del journal.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile icon={FileText}     label="Weekly Reports (30d)"  value={data.reports30d}        accent="#22d3ee" />
        <Tile icon={BookOpenCheck} label="Trade Evidence (30d)"  value={data.evidence30d}       accent="#34d399" />
        <Tile icon={NotebookPen}  label="Journal Lessons (30d)" value={data.journalLessons30d} accent="#a78bfa" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8]">
          Insights recientes ({data.insights.length})
        </h2>
        {data.insights.length === 0 ? (
          <p className="text-sm text-[#475569]">
            No hay insights en los últimos 30 días. Crea reportes, evidencia o entradas de journal
            para empezar.
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.insights.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3 hover:bg-[#151b28] transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#475569]">
                    {SOURCE_LABEL[item.source] ?? item.source}
                  </span>
                  {item.createdAt && (
                    <span className="text-[10px] text-[#475569]">
                      · {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-[#e2e8f0] line-clamp-1">{item.title}</p>
                <p className="text-xs text-[#94a3b8] mt-1 line-clamp-3">{item.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/5 p-4">
        <KnowledgeFactorySynthesis insights={data.insights.map((i) => ({ summary: i.summary }))} />
      </section>
    </div>
  );
}

function Tile({ icon: Icon, label, value, accent }: { icon: typeof FileText; label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: accent }} />
        <p className="text-[10px] uppercase tracking-wider text-[#475569]">{label}</p>
      </div>
      <p className="text-2xl font-bold font-mono" style={{ color: accent }}>{value}</p>
    </div>
  );
}
