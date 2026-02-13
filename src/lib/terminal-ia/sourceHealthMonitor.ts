// Source Health Monitor
// Detecta fuentes caídas, duplicados y días “vacíos” para el bot.

export interface SourceStatus {
  source: string;
  status: "ok" | "down" | "duplicate" | "empty";
}

export function monitorSources(sources: { source: string; data: unknown[] }[]): SourceStatus[] {
  return sources.map(s => {
    if (!s.data.length) return { source: s.source, status: "empty" };
    if (s.data.length > 1 && new Set(s.data.map(d => JSON.stringify(d))).size < s.data.length) return { source: s.source, status: "duplicate" };
    // Simulación: si el nombre contiene "fail" está caído
    if (s.source.includes("fail")) return { source: s.source, status: "down" };
    return { source: s.source, status: "ok" };
  });
}
