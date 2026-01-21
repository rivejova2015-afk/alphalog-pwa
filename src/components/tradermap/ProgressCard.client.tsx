// src/components/tradermap/ProgressCard.client.tsx
"use client";

interface UserLevelState {
  user_id: string;
  level: number;
  xp_total: number;
  streak_days: number;
  last_activity_date: string | null;
  updated_at: string;
}

interface ProgressCardProps {
  levelState: UserLevelState;
}

const LEVEL_NAMES = [
  "Paper Hands",
  "Apprentice",
  "Student",
  "Practitioner",
  "Journeyman",
  "Expert",
  "Master",
  "Elite",
  "Legend",
  "Apex Predator",
];

// XP required to reach each level (cumulative)
const XP_PER_LEVEL = [
  0, 100, 350, 850, 1850, 3850, 7850, 15850, 31850, 63850, 127850,
];

export default function ProgressCard({ levelState }: ProgressCardProps) {
  const currentLevel = Math.min(Math.max(levelState.level, 1), 10);
  const levelName = LEVEL_NAMES[currentLevel - 1] || "Apex Predator";

  // Calculate XP needed for current level and next level
  const currentLevelXpRequired = XP_PER_LEVEL[currentLevel - 1] || 0;
  const nextLevelXpRequired = XP_PER_LEVEL[currentLevel] || XP_PER_LEVEL[XP_PER_LEVEL.length - 1];

  const xpProgress = levelState.xp_total - currentLevelXpRequired;
  const xpNeeded = nextLevelXpRequired - currentLevelXpRequired;
  const xpPercent = xpNeeded > 0 ? (xpProgress / xpNeeded) * 100 : 100;

  const levelEmoji = [
    "🤏", // Paper Hands
    "👨‍🎓", // Apprentice
    "📚", // Student
    "🛠️", // Practitioner
    "⚙️", // Journeyman
    "🏆", // Expert
    "🧙", // Master
    "⚡", // Elite
    "👑", // Legend
    "🦅", // Apex Predator
  ][currentLevel - 1] || "🦅";

  return (
    <div className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Level Display */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-600/20 border-2 border-blue-500 mb-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{currentLevel}</div>
              <div className="text-sm text-blue-300">Nivel</div>
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">{levelEmoji} {levelName}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {levelState.xp_total.toLocaleString()} XP total
          </p>
        </div>

        {/* XP Progress */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-3">Progreso XP</p>
          <div className="space-y-2">
            <div className="relative w-full h-6 bg-slate-600 rounded-full overflow-hidden border border-slate-500">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(xpPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 text-center">
              {xpProgress.toLocaleString()} / {xpNeeded.toLocaleString()} XP
            </p>
          </div>
          {currentLevel >= 10 && (
            <p className="text-xs text-yellow-400 mt-2 text-center">✨ Máximo nivel alcanzado</p>
          )}
        </div>

        {/* Streak */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-3">Racha</p>
          <div className="bg-slate-800/50 border border-slate-600 rounded p-4">
            <p className="text-3xl font-bold text-orange-400">{levelState.streak_days}</p>
            <p className="text-xs text-slate-400 mt-1">días consecutivos</p>
            {levelState.streak_days > 0 && (
              <p className="text-xs text-orange-300 mt-2">
                🔥 ¡Sigue así! Tu racha está activa.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info Text */}
      <div className="mt-6 p-4 bg-slate-800/50 border border-slate-600 rounded text-sm text-slate-300">
        <p>
          Gana XP completando trades, evidencia y reportes. Sube de nivel para desbloquear
          nuevas funciones y refuerza tu racha operando días consecutivos.
        </p>
      </div>
    </div>
  );
}
