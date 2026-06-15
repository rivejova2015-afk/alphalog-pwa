// Higiene de datos del historial de quizzes (Fase H del roadmap).
//
// securities_quiz_results guarda CADA intento, sin tope. Con el tiempo crece sin
// control. La maestría/XP, sin embargo, derivan SOLO del mejor intento por lección
// (ver computeXp → bestByLesson), y la racha deriva de los días con actividad
// (ver activityDays). Por eso NO podemos borrar por antigüedad: perderíamos
// historia de racha y, si justo cae el mejor intento, maestría.
//
// La estrategia segura es un dedup "best-attempt": conservar lo justo para que
// maestría/XP Y racha queden idénticas, y descartar el resto de los intentos.
// Concretamente, se conserva:
//   1. el mejor intento por (usuario, lección)         → preserva maestría/XP
//   2. ≥1 intento por (usuario, día con actividad)     → preserva racha/activityDays
// y se borra todo lo que no caiga en ninguno de los dos conjuntos.

export interface QuizRow {
  id: string;
  user_id: string;
  lesson_id: number;
  score: number;
  total: number;
  taken_at: string; // ISO timestamp
  level?: string | null; // 'b' | 'i' | 'a' — filas históricas sin nivel = 'b'
}

function ratio(r: QuizRow): number {
  return r.total > 0 ? r.score / r.total : 0;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// La maestría deriva del mejor intento por (lección, NIVEL): hay que conservar el
// mejor de cada nivel, no solo el mejor de la lección, o se perderían las coronas
// de los niveles intermedio/avanzado (Fase A).
function lessonLevelKey(r: QuizRow): string {
  return `${r.lesson_id}:${r.level ?? "b"}`;
}

// `a` es "mejor" que `b` si tiene mayor ratio; a igualdad, el más reciente
// (taken_at mayor) gana, para conservar el intento más nuevo.
function isBetter(a: QuizRow, b: QuizRow): boolean {
  const ra = ratio(a), rb = ratio(b);
  if (ra !== rb) return ra > rb;
  return a.taken_at > b.taken_at;
}

/**
 * Dado el historial COMPLETO de intentos (de uno o varios usuarios), devuelve los
 * ids redundantes a borrar. Agrupa por usuario internamente, así que es seguro
 * pasarle filas de toda la tabla (cron con service role).
 *
 * Garantía: tras borrar estos ids, computeXp (best por lección y NIVEL) y
 * activityDays (días con actividad) producen exactamente el mismo resultado.
 */
export function idsToDelete(rows: QuizRow[]): string[] {
  const keep = new Set<string>();

  const byUser = new Map<string, QuizRow[]>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  for (const userRows of byUser.values()) {
    // 1) Mejor intento por (lección, nivel) — preserva maestría de cada nivel.
    const bestByLessonLevel = new Map<string, QuizRow>();
    for (const r of userRows) {
      const k = lessonLevelKey(r);
      const prev = bestByLessonLevel.get(k);
      if (!prev || isBetter(r, prev)) bestByLessonLevel.set(k, r);
    }
    for (const r of bestByLessonLevel.values()) keep.add(r.id);

    // 2) Asegurar ≥1 intento por día con actividad. Si el día ya tiene un intento
    //    conservado por la regla (1), no agregamos nada; si no, conservamos el
    //    mejor intento de ese día.
    const bestByDay = new Map<string, QuizRow>();
    for (const r of userRows) {
      const k = dayKey(r.taken_at);
      const prev = bestByDay.get(k);
      if (!prev || isBetter(r, prev)) bestByDay.set(k, r);
    }
    const keptDays = new Set<string>();
    for (const r of userRows) if (keep.has(r.id)) keptDays.add(dayKey(r.taken_at));
    for (const [k, r] of bestByDay) {
      if (!keptDays.has(k)) keep.add(r.id);
    }
  }

  return rows.filter((r) => !keep.has(r.id)).map((r) => r.id);
}
