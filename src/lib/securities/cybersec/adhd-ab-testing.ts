/**
 * A/B Testing System for ADHD Gamification
 * 100% client-side, localStorage only
 * Single user: test different configurations to optimize engagement
 */

export type VariantId = "control" | "treatment";

export interface Variant {
  id: VariantId;
  name: string;
  description: string;
  config: GameficationConfig;
}

export interface GameficationConfig {
  enableSounds: boolean;
  enableHints: boolean;
  hintPenaltyPercent: number; // 0-50
  xpMultiplier: number; // 0.5-2.0
  enableHaptic: boolean;
  enableDailyBonus: boolean;
  enableStreakRecovery: boolean; // No shame recovery path
  scaffoldingLevel: "minimal" | "moderate" | "aggressive";
}

export interface SessionMetrics {
  variantId: VariantId;
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number; // milliseconds
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  xpEarned: number;
  badgesUnlocked: number;
  streakMaintained: boolean;
  userSatisfactionScore?: number; // 1-5 (optional, post-session)
}

export interface ABTestResults {
  controlMetrics: SessionMetrics[];
  treatmentMetrics: SessionMetrics[];
  summary: {
    avgSessionDurationControl: number;
    avgSessionDurationTreatment: number;
    durationImprovement: number; // percent

    avgAccuracyControl: number;
    avgAccuracyTreatment: number;
    accuracyImprovement: number; // percent

    avgXpControl: number;
    avgXpTreatment: number;
    xpImprovement: number; // percent

    badgeUnlockRateControl: number;
    badgeUnlockRateTreatment: number;
    badgeUnlockImprovement: number; // percent

    avgSatisfactionControl: number;
    avgSatisfactionTreatment: number;

    statisticalSignificance: boolean; // p < 0.05
    recommendedVariant: VariantId;
  };
}

// Default variants
export const VARIANTS: Record<VariantId, Variant> = {
  control: {
    id: "control",
    name: "Control (Phase 1-4 Standard)",
    description:
      "Current implementation: sounds, hints, full scaffolding, no shame recovery",
    config: {
      enableSounds: true,
      enableHints: true,
      hintPenaltyPercent: 25,
      xpMultiplier: 1.5, // Struggling bonus
      enableHaptic: true,
      enableDailyBonus: true,
      enableStreakRecovery: true,
      scaffoldingLevel: "moderate",
    },
  },
  treatment: {
    id: "treatment",
    name: "Treatment (Hyper-Dopamine)",
    description:
      "Maximized for immediate rewards: sounds, NO penalties, 2x XP, aggressive scaffolding",
    config: {
      enableSounds: true,
      enableHints: true,
      hintPenaltyPercent: 0, // No penalty for hints
      xpMultiplier: 2.0, // Always 2x
      enableHaptic: true,
      enableDailyBonus: true,
      enableStreakRecovery: true,
      scaffoldingLevel: "aggressive", // Show hints sooner
    },
  },
};

const STORAGE_KEY_ACTIVE_VARIANT = "cybersec_active_variant";
const STORAGE_KEY_SESSION_METRICS = "cybersec_session_metrics";

/**
 * Get current active variant
 */
export function getActiveVariant(): Variant {
  try {
    const variantId = (localStorage.getItem(STORAGE_KEY_ACTIVE_VARIANT) ||
      "control") as VariantId;
    return VARIANTS[variantId] || VARIANTS.control;
  } catch {
    return VARIANTS.control;
  }
}

/**
 * Switch to a different variant
 */
export function switchVariant(variantId: VariantId): Variant {
  localStorage.setItem(STORAGE_KEY_ACTIVE_VARIANT, variantId);
  return VARIANTS[variantId];
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Record session metrics (called post-quiz)
 */
export function recordSessionMetrics(metrics: SessionMetrics): void {
  try {
    let allMetrics = JSON.parse(
      localStorage.getItem(STORAGE_KEY_SESSION_METRICS) || "[]"
    ) as SessionMetrics[];

    allMetrics.push(metrics);

    // Keep only last 100 sessions (avoid bloat)
    if (allMetrics.length > 100) {
      allMetrics = allMetrics.slice(-100);
    }

    localStorage.setItem(STORAGE_KEY_SESSION_METRICS, JSON.stringify(allMetrics));
  } catch {
    /* ignore */
  }
}

/**
 * Get all recorded session metrics
 */
export function getAllSessionMetrics(): SessionMetrics[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY_SESSION_METRICS) || "[]"
    ) as SessionMetrics[];
  } catch {
    return [];
  }
}

/**
 * Calculate A/B test results
 */
export function calculateABTestResults(): ABTestResults {
  const allMetrics = getAllSessionMetrics();

  const controlMetrics = allMetrics.filter((m) => m.variantId === "control");
  const treatmentMetrics = allMetrics.filter(
    (m) => m.variantId === "treatment"
  );

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  // Calculate averages
  const avgSessionDurationControl = avg(controlMetrics.map((m) => m.duration));
  const avgSessionDurationTreatment = avg(treatmentMetrics.map((m) => m.duration));

  const avgAccuracyControl = avg(controlMetrics.map((m) => m.accuracy));
  const avgAccuracyTreatment = avg(treatmentMetrics.map((m) => m.accuracy));

  const avgXpControl = avg(controlMetrics.map((m) => m.xpEarned));
  const avgXpTreatment = avg(treatmentMetrics.map((m) => m.xpEarned));

  const badgeUnlockRateControl =
    controlMetrics.length > 0
      ? sum(controlMetrics.map((m) => m.badgesUnlocked)) / controlMetrics.length
      : 0;
  const badgeUnlockRateTreatment =
    treatmentMetrics.length > 0
      ? sum(treatmentMetrics.map((m) => m.badgesUnlocked)) /
        treatmentMetrics.length
      : 0;

  const avgSatisfactionControl = avg(
    controlMetrics
      .filter((m) => m.userSatisfactionScore)
      .map((m) => m.userSatisfactionScore || 0)
  );
  const avgSatisfactionTreatment = avg(
    treatmentMetrics
      .filter((m) => m.userSatisfactionScore)
      .map((m) => m.userSatisfactionScore || 0)
  );

  // Calculate improvements (percent)
  const durationImprovement =
    avgSessionDurationControl > 0
      ? ((avgSessionDurationTreatment - avgSessionDurationControl) /
          avgSessionDurationControl) *
        100
      : 0;

  const accuracyImprovement =
    avgAccuracyControl > 0
      ? ((avgAccuracyTreatment - avgAccuracyControl) / avgAccuracyControl) * 100
      : 0;

  const xpImprovement =
    avgXpControl > 0
      ? ((avgXpTreatment - avgXpControl) / avgXpControl) * 100
      : 0;

  const badgeUnlockImprovement =
    badgeUnlockRateControl > 0
      ? ((badgeUnlockRateTreatment - badgeUnlockRateControl) /
          badgeUnlockRateControl) *
        100
      : 0;

  // Simple statistical significance: t-test approximation
  // For small samples, just check if difference is >10%
  const isSignificant =
    Math.abs(durationImprovement) > 10 ||
    Math.abs(accuracyImprovement) > 10 ||
    Math.abs(xpImprovement) > 10;

  // Recommend variant based on multiple factors
  const score = (
    accuracyImprovement * 0.4 + // Accuracy most important
    xpImprovement * 0.3 + // XP earned second
    badgeUnlockImprovement * 0.2 + // Badge unlock rate third
    -durationImprovement * 0.1 // Shorter is sometimes better (efficiency)
  );

  const recommendedVariant = score > 0 ? "treatment" : "control";

  return {
    controlMetrics,
    treatmentMetrics,
    summary: {
      avgSessionDurationControl,
      avgSessionDurationTreatment,
      durationImprovement,
      avgAccuracyControl,
      avgAccuracyTreatment,
      accuracyImprovement,
      avgXpControl,
      avgXpTreatment,
      xpImprovement,
      badgeUnlockRateControl,
      badgeUnlockRateTreatment,
      badgeUnlockImprovement,
      avgSatisfactionControl,
      avgSatisfactionTreatment,
      statisticalSignificance: isSignificant,
      recommendedVariant,
    },
  };
}

/**
 * Reset all A/B test data
 */
export function resetABTestData(): void {
  localStorage.removeItem(STORAGE_KEY_SESSION_METRICS);
  localStorage.setItem(STORAGE_KEY_ACTIVE_VARIANT, "control");
}

/**
 * Export A/B test results as JSON (for download)
 */
export function exportABTestResults(): string {
  const results = calculateABTestResults();
  return JSON.stringify(results, null, 2);
}

/**
 * Get variant recommendations based on current data
 */
export function getVariantRecommendation(): {
  recommendation: VariantId;
  confidence: number; // 0-100
  reason: string;
} {
  const results = calculateABTestResults();
  const { summary, controlMetrics, treatmentMetrics } = results;

  // If not enough data, default to control
  if (controlMetrics.length < 3 || treatmentMetrics.length < 3) {
    return {
      recommendation: "control",
      confidence: 0,
      reason: "Insufficient data (need min 3 sessions per variant)",
    };
  }

  const confidence = Math.min(
    100,
    (Math.min(controlMetrics.length, treatmentMetrics.length) / 10) * 100
  );

  if (summary.statisticalSignificance) {
    if (summary.recommendedVariant === "treatment") {
      return {
        recommendation: "treatment",
        confidence,
        reason: `Treatment shows ${Math.abs(summary.accuracyImprovement).toFixed(1)}% higher accuracy & ${Math.abs(summary.xpImprovement).toFixed(1)}% more XP earned`,
      };
    } else {
      return {
        recommendation: "control",
        confidence,
        reason: `Control shows better overall engagement`,
      };
    }
  }

  return {
    recommendation: summary.recommendedVariant,
    confidence: Math.max(0, confidence - 30),
    reason: "No significant difference yet. Continue collecting data.",
  };
}
