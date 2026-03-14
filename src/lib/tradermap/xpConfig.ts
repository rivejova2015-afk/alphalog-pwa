/**
 * TraderMap XP Configuration
 * Centralized XP reward values for all progress events.
 */

export const XP_VALUES = {
  /** XP awarded when a trade is completed and recorded */
  trade_complete: 10,
  /** XP awarded when a quarterly goal is completed */
  goal_complete: 500,
} as const;

export type XPEventType = keyof typeof XP_VALUES;
