// Report Diff (hoy vs último)
// Compara reportes y muestra “qué cambió” en 5 bullets.

export function diffReports(current: string, previous: string): string[] {
  // Simulación: compara líneas
  const currLines = current.split("\n");
  const prevLines = new Set(previous.split("\n"));
  return currLines.filter(l => !prevLines.has(l)).slice(0, 5);
}
