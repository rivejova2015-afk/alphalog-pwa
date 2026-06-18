// Helpers puros para conectar el resultado de un quiz con el progreso del módulo.
// Pensados para testearse en aislamiento (sin red).
import type { LevelKey } from "./types";

const LEVEL_ORDER: LevelKey[] = ["b", "i", "a"];

// "M5" → 5. Devuelve null si el sub no tiene la forma "M<número>".
export function moduleIdFromSub(sub: string): number | null {
  const m = /^M(\d+)$/.exec(sub.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

// Unión idempotente: agrega `add` si falta y devuelve los niveles en orden estable b/i/a.
export function mergeCompletedLevels(existing: string[], add: LevelKey): LevelKey[] {
  const set = new Set<string>(existing);
  set.add(add);
  return LEVEL_ORDER.filter((lv) => set.has(lv));
}
