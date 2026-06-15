// Modo de desbloqueo del camino. 'soft' = todo accesible (default, bueno para
// contenido técnico); 'strict' = lineal (dominá el actual para abrir el siguiente);
// 'block' = por sección (el bloque siguiente abre al completar el anterior).
export type GatingMode = "soft" | "strict" | "block";

export const GATING_MODES: GatingMode[] = ["soft", "strict", "block"];

// Un módulo se considera "dominado" para gating con al menos 1 corona (quiz aprobado).
function mastered(mastery: Record<number, number>, m: number): boolean {
  return (mastery[m] ?? 0) >= 1;
}

// Devuelve el set de módulos BLOQUEADOS según el modo y el progreso.
export function lockedModules(
  mode: GatingMode,
  ordered: { m: number; cat: string }[],
  mastery: Record<number, number>,
): Set<number> {
  const locked = new Set<number>();
  if (mode === "soft") return locked;

  if (mode === "strict") {
    let unlocked = true;
    for (const it of ordered) {
      if (!unlocked) { locked.add(it.m); continue; }
      // El primer no-dominado queda abierto (es el "actual"); a partir del siguiente, bloqueado.
      if (!mastered(mastery, it.m)) unlocked = false;
    }
    return locked;
  }

  // mode === "block": cada categoría se desbloquea si la anterior está completa.
  const cats: string[] = [];
  const byCat = new Map<string, number[]>();
  for (const it of ordered) {
    if (!byCat.has(it.cat)) { byCat.set(it.cat, []); cats.push(it.cat); }
    byCat.get(it.cat)!.push(it.m);
  }
  let prevComplete = true; // el primer bloque siempre abierto
  for (const cat of cats) {
    const ms = byCat.get(cat)!;
    if (!prevComplete) { ms.forEach((m) => locked.add(m)); continue; }
    prevComplete = ms.every((m) => mastered(mastery, m));
  }
  return locked;
}
