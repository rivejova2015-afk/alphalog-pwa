"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

type SynthesisResult = {
  synthesis: string;
  key_lessons: string[];
  action_items: string[];
};

type Props = {
  insights: Array<{ summary: string }>;
};

export default function KnowledgeFactorySynthesis({ insights }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SynthesisResult | null>(null);

  const handleSynthesize = useCallback(async () => {
    if (insights.length === 0) {
      toast.error("No hay insights disponibles para sintetizar.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const insightStrings = insights
        .map((item) => item.summary)
        .filter((text) => text.trim().length > 0)
        .slice(0, 10);

      if (insightStrings.length === 0) {
        toast.error("Los insights no contienen texto suficiente para sintetizar.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/intelligence/knowledge-factory/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insights: insightStrings, period: "month" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Error desconocido" }));
        const message = (data as { error?: string }).error || `Error ${response.status}`;
        toast.error(message);
        setLoading(false);
        return;
      }

      const data = (await response.json()) as {
        ok: boolean;
        synthesis: string;
        key_lessons: string[];
        action_items: string[];
      };

      setResult({
        synthesis: data.synthesis,
        key_lessons: data.key_lessons || [],
        action_items: data.action_items || [],
      });

      toast.success("Sintesis generada correctamente.");
    } catch {
      toast.error("Error de red al generar la sintesis.");
    } finally {
      setLoading(false);
    }
  }, [insights]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Sintesis con IA</h3>
        <button
          type="button"
          onClick={handleSynthesize}
          disabled={loading || insights.length === 0}
          className="rounded border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Sintetizando..." : "Sintetizar con IA"}
        </button>
      </div>

      {insights.length === 0 && (
        <p className="text-sm text-slate-400">
          Agrega reportes, evidencia o entradas de journal para habilitar la sintesis.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded border border-slate-700/70 bg-slate-900/50 p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-slate-300">
            Analizando {insights.length} insight{insights.length !== 1 ? "s" : ""} con IA...
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded border border-slate-700/70 bg-slate-900/50 p-4">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Sintesis
            </h4>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
              {result.synthesis}
            </p>
          </div>

          {result.key_lessons.length > 0 && (
            <div className="rounded border border-slate-700/70 bg-slate-900/50 p-4">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Lecciones clave
              </h4>
              <ul className="space-y-2">
                {result.key_lessons.map((lesson, index) => (
                  <li
                    key={`lesson-${index}`}
                    className="flex items-start gap-2 text-sm text-slate-200"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-bold text-cyan-400">
                      {index + 1}
                    </span>
                    <span>{lesson}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.action_items.length > 0 && (
            <div className="rounded border border-slate-700/70 bg-slate-900/50 p-4">
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Pasos de accion
              </h4>
              <ul className="space-y-2">
                {result.action_items.map((action, index) => (
                  <li
                    key={`action-${index}`}
                    className="flex items-start gap-2 text-sm text-slate-200"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
