/**
 * ADHD Adaptive System — Dynamic difficulty & smart scaffolding
 * Detects struggle patterns and offers help before the user gives up
 */

export interface PerformanceMetrics {
  consecutiveWrong: number;
  accuracyRate: number;
  timePerQuestion: number;
  totalQuestionsAnswered: number;
  strugglingModules: Set<number>;
}

export type ScaffoldingLevel = "flowing" | "struggling" | "mastering";

export interface ScaffoldingStrategy {
  level: ScaffoldingLevel;
  showHints: boolean;
  hintPenalty: number; // % of XP lost for using hint
  showExplanation: boolean;
  explicitNextStep: boolean;
  emotionalSupport: string;
  xpMultiplier: number;
  skipOption: boolean; // Allow skip after N wrong attempts
}

/**
 * Detect struggle patterns in real-time
 */
export function detectStruggle(metrics: PerformanceMetrics): ScaffoldingLevel {
  // Mastering: high accuracy, fast, consistent
  if (
    metrics.accuracyRate >= 0.9 &&
    metrics.timePerQuestion < 30 &&
    metrics.consecutiveWrong === 0
  ) {
    return "mastering";
  }

  // Struggling: low accuracy or many consecutive wrong
  if (metrics.accuracyRate < 0.6 || metrics.consecutiveWrong >= 3) {
    return "struggling";
  }

  // Flowing: middle ground
  return "flowing";
}

/**
 * Get adaptive scaffolding strategy based on performance
 */
export function getScaffoldingStrategy(
  level: ScaffoldingLevel
): ScaffoldingStrategy {
  const strategies: Record<ScaffoldingLevel, ScaffoldingStrategy> = {
    mastering: {
      level: "mastering",
      showHints: false,
      hintPenalty: 0,
      showExplanation: false,
      explicitNextStep: false,
      emotionalSupport: "🚀 You're crushing it!",
      xpMultiplier: 2.0, // Bonus for speedrun
      skipOption: false,
    },
    flowing: {
      level: "flowing",
      showHints: false,
      hintPenalty: 0,
      showExplanation: true,
      explicitNextStep: false,
      emotionalSupport: "✓ Nice! Keep going",
      xpMultiplier: 1.0,
      skipOption: false,
    },
    struggling: {
      level: "struggling",
      showHints: true,
      hintPenalty: 0.25, // 25% XP penalty for hint
      showExplanation: true,
      explicitNextStep: true,
      emotionalSupport: "💪 Struggle is learning. Try a hint?",
      xpMultiplier: 1.5, // Bonus despite difficulty (encouragement)
      skipOption: true, // After 3 wrong, allow skip
    },
  };

  return strategies[level];
}

/**
 * Smart Notification Timing — when to interrupt the user
 * (Not recommended to send - only for scheduling external notifications)
 */
export interface NotificationTiming {
  shouldSend: boolean;
  bestTime: Date;
  reason: string;
  urgency: "low" | "medium" | "high";
}

export function calculateOptimalNotificationTime(): NotificationTiming {
  // ADHD attention patterns:
  // - Peak attention: 9-11 AM, 2-4 PM (after meals/exercise)
  // - Low attention: 3-5 PM (post-lunch dip), late evening (fatigue)
  // - Post-notification optimal: wait 15-30 min before sending next

  const now = new Date();
  const hour = now.getHours();

  // Find next peak attention window
  let bestHour: number;
  let reason: string;

  if (hour < 9) {
    bestHour = 9;
    reason = "Morning peak (9-11 AM)";
  } else if (hour < 11) {
    bestHour = hour;
    reason = "Current morning peak";
  } else if (hour < 14) {
    bestHour = 14;
    reason = "Post-lunch recovery (2-4 PM)";
  } else if (hour < 16) {
    bestHour = hour;
    reason = "Current afternoon peak";
  } else {
    // Tomorrow morning peak
    bestHour = 9;
    reason = "Tomorrow morning peak";
  }

  const optimalTime = new Date();
  optimalTime.setHours(bestHour, 0, 0, 0);

  // If optimal time is in the past, move to next window
  if (optimalTime < now) {
    if (bestHour === 9) {
      optimalTime.setDate(optimalTime.getDate() + 1);
    } else if (bestHour === 14) {
      optimalTime.setHours(14, 0, 0, 0);
      if (optimalTime < now) {
        optimalTime.setDate(optimalTime.getDate() + 1);
        optimalTime.setHours(9, 0, 0, 0);
      }
    }
  }

  return {
    shouldSend: true,
    bestTime: optimalTime,
    reason,
    urgency: hour >= 20 ? "low" : hour >= 15 ? "medium" : "high",
  };
}

/**
 * Hacker Rank progression system (0-100 levels)
 */
export interface HackerRankProgress {
  level: number;
  xpInLevel: number;
  xpToNextLevel: number;
  percentProgress: number;
  rankTitle: string;
  nextMilestone: number;
}

const RANK_TIERS = [
  { level: 0, title: "Script Kiddie", xpPerLevel: 50 },
  { level: 10, title: "Security Analyst", xpPerLevel: 75 },
  { level: 20, title: "Security Engineer", xpPerLevel: 100 },
  { level: 30, title: "Security Architect", xpPerLevel: 150 },
  { level: 50, title: "Master Hacker", xpPerLevel: 200 },
  { level: 75, title: "Legendary Operator", xpPerLevel: 250 },
  { level: 90, title: "Elite Guardian", xpPerLevel: 300 },
];

export function getHackerRankTitle(level: number): string {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (level >= RANK_TIERS[i].level) {
      return RANK_TIERS[i].title;
    }
  }
  return "Novice";
}

export function getXpPerLevel(level: number): number {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (level >= RANK_TIERS[i].level) {
      return RANK_TIERS[i].xpPerLevel;
    }
  }
  return 50;
}

export function calculateHackerRankProgress(
  totalXp: number,
  currentLevel: number
): HackerRankProgress {
  // Calculate XP within current level
  let xpAccumulated = 0;
  for (let i = 0; i < currentLevel; i++) {
    xpAccumulated += getXpPerLevel(i);
  }

  const xpInLevel = totalXp - xpAccumulated;
  const xpNeeded = getXpPerLevel(currentLevel);
  const percentProgress = (xpInLevel / xpNeeded) * 100;

  // Find next milestone
  let nextMilestone = currentLevel + 1;
  while (nextMilestone < 100 && getHackerRankTitle(nextMilestone) === getHackerRankTitle(currentLevel)) {
    nextMilestone++;
  }

  return {
    level: currentLevel,
    xpInLevel: Math.floor(xpInLevel),
    xpToNextLevel: xpNeeded,
    percentProgress: Math.min(100, percentProgress),
    rankTitle: getHackerRankTitle(currentLevel),
    nextMilestone,
  };
}

/**
 * Hint generation system
 */
export const HINT_TEMPLATES = {
  basic: [
    "Try reading the question again carefully.",
    "What do the key terms mean?",
    "Think about the real-world scenario.",
  ],
  intermediate: [
    "What's the common pattern here?",
    "How does this relate to the concept?",
    "Check your assumptions.",
  ],
  advanced: [
    "This requires combining 2-3 concepts.",
    "Look for the edge case.",
    "What security principle applies?",
  ],
};

export function getHintForDifficulty(
  difficulty: "basic" | "intermediate" | "advanced"
): string {
  const hints = HINT_TEMPLATES[difficulty];
  return hints[Math.floor(Math.random() * hints.length)];
}

/**
 * Encouragement messages for different struggle scenarios
 */
export const ENCOURAGEMENT = {
  consecutiveWrong: [
    "💪 Struggle builds strength. Want a hint?",
    "🎯 This one's tricky. Let me help.",
    "🔍 Different angle needed here.",
  ],
  lowAccuracy: [
    "📚 These concepts need practice. Hints are on.",
    "🌱 Learning curve is normal. You're making progress.",
    "⏸️ Want to skip and come back later?",
  ],
  slowProgress: [
    "⏱️ Take your time. Speed comes with practice.",
    "🧠 Complex topic. That's okay.",
    "✨ You're thinking deeply. Good sign.",
  ],
};

export function getEncouragement(scenario: keyof typeof ENCOURAGEMENT): string {
  const messages = ENCOURAGEMENT[scenario];
  return messages[Math.floor(Math.random() * messages.length)];
}
