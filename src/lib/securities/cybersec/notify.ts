// Decide si y qué recordatorio de hábito enviar, dado el estado del día.
// Puro → testeable. El cron decide el horario; esto decide el contenido.

export interface ReminderPayload {
  kind: "streak" | "goal";
  title: string;
  body: string;
}

export function streakReminder(streak: number, xpToday: number, dailyGoal: number): ReminderPayload | null {
  // Racha en riesgo: tiene racha y todavía no hizo nada hoy.
  if (streak >= 1 && xpToday <= 0) {
    return {
      kind: "streak",
      title: `🔥 No pierdas tu racha de ${streak} día${streak === 1 ? "" : "s"}`,
      body: "Estudiá algo hoy en CyberSec Academy para mantenerla.",
    };
  }
  // Meta diaria casi cumplida: estudió algo pero le falta para la meta.
  if (xpToday > 0 && xpToday < dailyGoal) {
    return {
      kind: "goal",
      title: "🎯 Te falta poco para tu meta de hoy",
      body: `Llevás ${xpToday}/${dailyGoal} XP. ¡Cerrá el día completo!`,
    };
  }
  return null;
}
