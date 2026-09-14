/**
 * ADHD-Optimized Gamification System for CyberSec Academy
 * Core utilities: sounds, XP, streaks, dopamine feedback
 */

export type SoundType = "correct" | "incorrect" | "badge" | "levelup" | "streak";

/**
 * Play audio feedback for quiz interactions
 * Using Web Audio API for low-latency, browser-native sounds
 */
export function playSound(type: SoundType): void {
  if (typeof window === "undefined") return;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);

    switch (type) {
      case "correct": {
        // Rising "ding" - F4 to B4
        const osc = audioContext.createOscillator();
        osc.type = "sine";
        osc.connect(gain);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.frequency.setValueAtTime(349.23, now); // F4
        osc.frequency.exponentialRampToValueAtTime(493.88, now + 0.3); // B4
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }

      case "incorrect": {
        // Gentle "boop" - single low note
        const osc = audioContext.createOscillator();
        osc.type = "sine";
        osc.connect(gain);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.frequency.setValueAtTime(220, now); // A3
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }

      case "badge": {
        // Orchestral hit
        const freqs = [261.63, 329.63, 392.0]; // C4, E4, G4 - upward chord
        freqs.forEach((freq, idx) => {
          const osc = audioContext.createOscillator();
          osc.type = "sine";
          osc.connect(gain);
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          osc.start(now + idx * 0.05);
          osc.stop(now + 2);
        });
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2);
        break;
      }

      case "levelup": {
        // Heroic ascending sequence
        const freqs = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5
        freqs.forEach((freq, idx) => {
          const osc = audioContext.createOscillator();
          osc.type = "sine";
          osc.connect(gain);
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          osc.start(now + idx * 0.1);
          osc.stop(now + 3);
        });
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 3);
        break;
      }

      case "streak": {
        // Celebratory "tada" - quick upbeat
        const osc = audioContext.createOscillator();
        osc.type = "triangle";
        osc.connect(gain);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.5);
        osc.start(now);
        osc.stop(now + 1);
        break;
      }
    }
  } catch (err) {
    // Silent fail - audio context might be blocked or unavailable
  }
}

/**
 * Haptic feedback for mobile devices
 */
export function triggerHaptic(type: "tick" | "pulse" | "burst"): void {
  if (typeof window === "undefined" || !navigator.vibrate) return;

  switch (type) {
    case "tick":
      navigator.vibrate(20);
      break;
    case "pulse":
      navigator.vibrate([100, 50, 100, 50, 100]);
      break;
    case "burst":
      navigator.vibrate(200);
      break;
  }
}

/**
 * XP and streak storage management
 */
interface UserGameState {
  totalXp: number;
  level: number;
  currentStreak: number;
  lastStreakDate: string; // ISO date
  badges: Set<string>;
}

const STORAGE_KEY = "cybersec.gamestate";
const XP_PER_LEVEL = 500;

export function getUserGameState(): UserGameState {
  if (typeof window === "undefined") {
    return {
      totalXp: 0,
      level: 1,
      currentStreak: 0,
      lastStreakDate: new Date().toISOString().split("T")[0],
      badges: new Set(),
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        totalXp: 0,
        level: 1,
        currentStreak: 0,
        lastStreakDate: new Date().toISOString().split("T")[0],
        badges: new Set(),
      };
    }

    const parsed = JSON.parse(raw) as Omit<UserGameState, "badges"> & { badges: string[] };
    return {
      ...parsed,
      badges: new Set(parsed.badges),
    };
  } catch {
    return {
      totalXp: 0,
      level: 1,
      currentStreak: 0,
      lastStreakDate: new Date().toISOString().split("T")[0],
      badges: new Set(),
    };
  }
}

export function updateGameState(updates: Partial<UserGameState>): UserGameState {
  const current = getUserGameState();
  const next: UserGameState = {
    ...current,
    ...updates,
    badges: updates.badges ?? current.badges,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...next,
        badges: Array.from(next.badges),
      }));
    } catch {
      // Storage quota exceeded, silent fail
    }
  }

  return next;
}

export function addXp(amount: number): { xpAdded: number; newLevel: number; leveledUp: boolean } {
  const state = getUserGameState();
  const newTotal = state.totalXp + amount;
  const newLevel = Math.floor(newTotal / XP_PER_LEVEL) + 1;
  const leveledUp = newLevel > state.level;

  updateGameState({
    totalXp: newTotal,
    level: newLevel,
  });

  return {
    xpAdded: amount,
    newLevel,
    leveledUp,
  };
}

/**
 * Check and update streak
 * Returns { streakMaintained, streakBroken, currentStreak }
 */
export function updateStreak(): {
  streakMaintained: boolean;
  streakBroken: boolean;
  currentStreak: number;
  dailyBonusEarned: boolean;
} {
  const state = getUserGameState();
  const today = new Date().toISOString().split("T")[0];
  const lastDate = state.lastStreakDate;

  // Same day - no change
  if (lastDate === today) {
    return {
      streakMaintained: true,
      streakBroken: false,
      currentStreak: state.currentStreak,
      dailyBonusEarned: false,
    };
  }

  // Calculate days since last streak
  const lastDateObj = new Date(lastDate);
  const todayObj = new Date(today);
  const daysDiff = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff === 1) {
    // Consecutive day - maintain streak
    const newStreak = state.currentStreak + 1;
    updateGameState({
      currentStreak: newStreak,
      lastStreakDate: today,
    });

    return {
      streakMaintained: true,
      streakBroken: false,
      currentStreak: newStreak,
      dailyBonusEarned: true,
    };
  } else {
    // Streak broken
    updateGameState({
      currentStreak: 1,
      lastStreakDate: today,
    });

    return {
      streakMaintained: false,
      streakBroken: true,
      currentStreak: 1,
      dailyBonusEarned: true,
    };
  }
}

/**
 * Get progress toward next level
 */
export function getLevelProgress(): {
  currentXp: number;
  xpToNextLevel: number;
  percentage: number;
  currentLevel: number;
} {
  const state = getUserGameState();
  const xpInCurrentLevel = state.totalXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;
  const percentage = (xpInCurrentLevel / XP_PER_LEVEL) * 100;

  return {
    currentXp: xpInCurrentLevel,
    xpToNextLevel,
    percentage,
    currentLevel: state.level,
  };
}

/**
 * Badge system
 */
export const BADGES = {
  FIRST_QUIZ: "first-quiz",
  STREAK_7: "streak-7",
  STREAK_30: "streak-30",
  LEVEL_5: "level-5",
  LEVEL_10: "level-10",
  PERFECT_SCORE: "perfect-score",
  SPEED_RUN: "speed-run", // Complete quiz in 50% of time limit
} as const;

export function checkAndAwardBadges(context: {
  score?: number;
  total?: number;
  timeSpent?: number;
  timeLimit?: number;
  currentStreak?: number;
  currentLevel?: number;
}): string[] {
  const state = getUserGameState();
  const newBadges: string[] = [];

  // First quiz
  if (state.badges.size === 0) {
    state.badges.add(BADGES.FIRST_QUIZ);
    newBadges.push(BADGES.FIRST_QUIZ);
  }

  // Streak badges
  if (context.currentStreak === 7 && !state.badges.has(BADGES.STREAK_7)) {
    state.badges.add(BADGES.STREAK_7);
    newBadges.push(BADGES.STREAK_7);
  }

  if (context.currentStreak === 30 && !state.badges.has(BADGES.STREAK_30)) {
    state.badges.add(BADGES.STREAK_30);
    newBadges.push(BADGES.STREAK_30);
  }

  // Level badges
  if (context.currentLevel && context.currentLevel >= 5 && !state.badges.has(BADGES.LEVEL_5)) {
    state.badges.add(BADGES.LEVEL_5);
    newBadges.push(BADGES.LEVEL_5);
  }

  if (context.currentLevel && context.currentLevel >= 10 && !state.badges.has(BADGES.LEVEL_10)) {
    state.badges.add(BADGES.LEVEL_10);
    newBadges.push(BADGES.LEVEL_10);
  }

  // Perfect score
  if (
    context.score !== undefined &&
    context.total !== undefined &&
    context.score === context.total &&
    !state.badges.has(BADGES.PERFECT_SCORE)
  ) {
    state.badges.add(BADGES.PERFECT_SCORE);
    newBadges.push(BADGES.PERFECT_SCORE);
  }

  // Speed run
  if (
    context.timeSpent !== undefined &&
    context.timeLimit !== undefined &&
    context.timeSpent < context.timeLimit * 0.5 &&
    !state.badges.has(BADGES.SPEED_RUN)
  ) {
    state.badges.add(BADGES.SPEED_RUN);
    newBadges.push(BADGES.SPEED_RUN);
  }

  if (newBadges.length > 0) {
    updateGameState({ badges: state.badges });
  }

  return newBadges;
}

/**
 * Daily attempts limit
 */
const ATTEMPTS_KEY = (lessonId: number) => `cybersec.attempts.${lessonId}`;

export function getAttemptsRemaining(lessonId: number): number {
  if (typeof window === "undefined") return 7;

  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY(lessonId));
    if (!raw) return 7;

    const data = JSON.parse(raw) as { date: string; remaining: number };
    const today = new Date().toISOString().split("T")[0];

    // If date changed, reset to 7
    if (data.date !== today) {
      return 7;
    }

    return Math.max(0, data.remaining);
  } catch {
    return 7;
  }
}

export function useAttempt(lessonId: number): { remaining: number; canAttempt: boolean } {
  if (typeof window === "undefined") {
    return { remaining: 7, canAttempt: true };
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const raw = localStorage.getItem(ATTEMPTS_KEY(lessonId));
    let remaining = 7;

    if (raw) {
      const data = JSON.parse(raw) as { date: string; remaining: number };
      // Reset if new day
      if (data.date === today) {
        remaining = Math.max(0, data.remaining - 1);
      }
    } else {
      remaining = 6; // First use today
    }

    localStorage.setItem(ATTEMPTS_KEY(lessonId), JSON.stringify({ date: today, remaining }));
    return { remaining, canAttempt: remaining >= 0 };
  } catch {
    return { remaining: 7, canAttempt: true };
  }
}
