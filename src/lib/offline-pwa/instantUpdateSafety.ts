// Instant Update Safety
// Antes de auto-refresh, verifica que no haya operaciones pendientes locales.

export function canAutoRefresh(hasPendingOps: boolean): boolean {
  return !hasPendingOps;
}
