import { getMindOpsData } from "@/lib/intelligence/metrics";

const moodLabel = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === "excellent") return "Excellent";
  if (normalized === "good") return "Good";
  if (normalized === "bad") return "Bad";
  if (normalized === "terrible") return "Terrible";
  return "Neutral";
};

export default async function MindOpsTab() {
  const data = await getMindOpsData();

  if (!data.authenticated) {
    return (
      <div className="premium-card">
        <h2 className="text-2xl font-bold text-gold mb-2">MindOps</h2>
        <p className="text-slate-300">Inicia sesion para cargar analitica de journal y sesgos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="premium-card">
        <h2 className="text-2xl font-bold text-gold mb-2">MindOps</h2>
        <p className="text-slate-300">
          Seguimiento emocional y de disciplina a partir de tus entradas de journal.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Mood score 7d</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.moodScore7d.toFixed(1)} / 10</p>
          <p className="mt-1 text-xs text-slate-500">{data.entries7d} entradas analizadas</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Mood score 30d</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.moodScore30d.toFixed(1)} / 10</p>
          <p className="mt-1 text-xs text-slate-500">{data.entries30d} entradas analizadas</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Cadencia journal</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.entries7d} / 7d</p>
          <p className="mt-1 text-xs text-slate-500">Meta recomendada: minimo 3</p>
        </div>
        <div className="premium-card">
          <p className="text-xs uppercase text-slate-400">Tags detectados</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.topTags.length}</p>
          <p className="mt-1 text-xs text-slate-500">Top tags en 30 dias</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="premium-card">
          <h3 className="text-lg font-semibold text-white mb-3">Mood breakdown (30d)</h3>
          {data.moodBreakdown.length === 0 ? (
            <p className="text-slate-400">Sin datos de mood en el periodo.</p>
          ) : (
            <div className="space-y-2">
              {data.moodBreakdown.map((item) => (
                <div
                  key={item.mood}
                  className="flex items-center justify-between rounded border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{moodLabel(item.mood)}</span>
                  <span className="text-slate-100 font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="premium-card">
          <h3 className="text-lg font-semibold text-white mb-3">Top tags (30d)</h3>
          {data.topTags.length === 0 ? (
            <p className="text-slate-400">Aun no hay tags frecuentes.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.topTags.map((tag) => (
                <span
                  key={tag.tag}
                  className="rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1 text-xs text-slate-200"
                >
                  {tag.tag} ({tag.count})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="premium-card">
        <h3 className="text-lg font-semibold text-white mb-3">Action items detectados</h3>
        {data.actionItems.length === 0 ? (
          <p className="text-slate-400">No hay action items recientes en las entradas.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-200">
            {data.actionItems.map((item) => (
              <li key={item} className="rounded border border-slate-700/70 bg-slate-900/50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
