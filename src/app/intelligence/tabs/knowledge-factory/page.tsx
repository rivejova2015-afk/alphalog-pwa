import { getKnowledgeFactoryData } from "@/lib/intelligence/metrics";
import KnowledgeFactorySynthesis from "@/components/intelligence/KnowledgeFactorySynthesis.client";

const sourceLabel: Record<string, string> = {
  weekly_report: "Weekly report",
  trade_evidence: "Trade evidence",
  terminal_report: "Terminal report",
  journal: "Journal",
};

export default async function KnowledgeFactoryTab() {
  const data = await getKnowledgeFactoryData();

  if (!data.authenticated) {
    return (
      <div className="premium-card">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Knowledge Factory</h2>
        <p className="text-slate-300">Inicia sesion para ver sintesis accionables.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="premium-card">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Knowledge Factory (SECI)</h2>
        <p className="text-slate-300">
          Sintesis operativa construida con reportes, evidencia y lecciones de journal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Reportes 30d</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.reports30d}</p>
          <p className="mt-1 text-xs text-slate-500">TradeHub + Terminal</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Evidence 30d</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.evidence30d}</p>
          <p className="mt-1 text-xs text-slate-500">Registros en Evidence Vault</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Lessons 30d</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.journalLessons30d}</p>
          <p className="mt-1 text-xs text-slate-500">Lecciones extraidas de journal</p>
        </div>
      </div>

      <div className="premium-card">
        <h3 className="text-lg font-semibold text-white mb-3">Resumen accionable</h3>
        {data.insights.length === 0 ? (
          <p className="text-slate-400">
            Aun no hay suficiente contexto para sintetizar conocimiento. Agrega reportes y entradas.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.insights.map((item) => (
              <li key={`${item.source}-${item.id}`} className="rounded border border-slate-700/70 bg-slate-900/50 p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    {sourceLabel[item.source]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Sin fecha"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-sm text-slate-300">{item.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="premium-card">
        <KnowledgeFactorySynthesis
          insights={data.insights.map((item) => ({ summary: item.summary }))}
        />
      </div>
    </div>
  );
}
