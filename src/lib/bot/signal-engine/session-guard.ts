import type { SessionStatus } from "./types";

// Horarios en minutos desde medianoche UTC (lunes-viernes)
const LONDON_OPEN_MIN = 8 * 60; // 08:00 UTC
const LONDON_CLOSE_MIN = 17 * 60; // 17:00 UTC
const NY_OPEN_MIN = 13 * 60; // 13:00 UTC
const NY_CLOSE_MIN = 22 * 60; // 22:00 UTC

// Solapamiento NY+London: 13:00–17:00 UTC (mayor actividad)
const OVERLAP_OPEN_MIN = NY_OPEN_MIN; // 13:00
const OVERLAP_CLOSE_MIN = LONDON_CLOSE_MIN; // 17:00

// ─────────────────────────────────────────────────────────────────────────────
// Determina si la sesión de trading está activa para XAUUSD.
// Prioridad de sesiones: OVERLAP > LONDON > NY > CLOSED.
// Fines de semana: siempre CLOSED.
// Si session = CLOSED → el Signal Engine retorna SKIP automáticamente.
// ─────────────────────────────────────────────────────────────────────────────
export function isSessionActive(now: Date): SessionStatus {
  const dayUTC = now.getUTCDay(); // 0 = domingo, 6 = sábado

  if (dayUTC === 0 || dayUTC === 6) {
    return { active: false, session: "CLOSED", minutesUntilClose: 0 };
  }

  const currentMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  const inLondon = currentMin >= LONDON_OPEN_MIN && currentMin < LONDON_CLOSE_MIN;
  const inNY = currentMin >= NY_OPEN_MIN && currentMin < NY_CLOSE_MIN;
  const inOverlap = currentMin >= OVERLAP_OPEN_MIN && currentMin < OVERLAP_CLOSE_MIN;

  if (inOverlap) {
    return {
      active: true,
      session: "OVERLAP",
      minutesUntilClose: OVERLAP_CLOSE_MIN - currentMin,
    };
  }

  if (inLondon) {
    return {
      active: true,
      session: "LONDON",
      minutesUntilClose: LONDON_CLOSE_MIN - currentMin,
    };
  }

  if (inNY) {
    return {
      active: true,
      session: "NY",
      minutesUntilClose: NY_CLOSE_MIN - currentMin,
    };
  }

  return { active: false, session: "CLOSED", minutesUntilClose: 0 };
}
