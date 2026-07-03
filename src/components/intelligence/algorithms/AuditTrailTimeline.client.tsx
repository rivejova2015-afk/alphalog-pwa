"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  changes: Record<string, unknown> | null;
  status: "success" | "failure" | "partial" | "skipped";
  error_message: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Creado",
  update: "Actualizado",
  delete: "Eliminado",
  export: "Exportado",
  api_call: "Llamada API",
};

function StatusIcon({ status }: { status: AuditEntry["status"] }) {
  if (status === "success") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "failure") return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <MinusCircle className="w-3.5 h-3.5 text-slate-500" />;
}

export default function AuditTrailTimeline({ algorithmId }: { algorithmId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/algorithms/${algorithmId}/audit-trail`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (!cancelled) setEntries(json.entries ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error desconocido");
      }
    })();
    return () => { cancelled = true; };
  }, [algorithmId]);

  if (error) {
    return <p className="text-xs text-red-400">Error cargando audit trail: {error}</p>;
  }

  if (entries === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-8 bg-slate-800/40 rounded animate-pulse" />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-xs text-slate-500">Sin actividad registrada todavía.</p>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-xs">
          <StatusIcon status={e.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-200 font-medium">{ACTION_LABELS[e.action] ?? e.action}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">{e.resource_type === "algorithm_deployment" ? "Deployment" : "Algoritmo"}</span>
              <span className="text-slate-600 ml-auto font-mono text-[10px]">
                {new Date(e.created_at).toLocaleString()}
              </span>
            </div>
            {e.error_message && (
              <p className="text-red-400/80 mt-0.5">{e.error_message}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
