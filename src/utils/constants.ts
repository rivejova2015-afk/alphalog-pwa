// Color Palette (AlphaLog 2.1)
export const COLORS = {
  BG_PRIMARY: '#0a0e1a',
  BG_SURFACE: '#151b28',
  BORDER: '#1f2937',
  BORDER_HI: '#2d3748',
  TEXT_PRIMARY: '#e2e8f0',
  TEXT_SECONDARY: '#94a3b8',
  TEXT_MUTED: '#475569',
  CYAN: '#22d3ee',
  GREEN: '#34d399',
  RED: '#ef4444',
  YELLOW: '#eab308',
  PURPLE: '#c084fc',
  BLUE: '#60a5fa',
} as const;

// Status Colors
export const STATUS_COLORS = {
  ACTIVE: COLORS.GREEN,
  PAUSED: COLORS.YELLOW,
  ERROR: COLORS.RED,
  PENDING: COLORS.YELLOW,
  ON_TRACK: COLORS.GREEN,
  BELOW_PACE: COLORS.YELLOW,
  EXCEEDED: COLORS.GREEN,
  WARNING: COLORS.RED,
} as const;

// Metric Colors
export const METRIC_COLORS = {
  POSITIVE: COLORS.GREEN,
  NEGATIVE: COLORS.RED,
  NEUTRAL: COLORS.CYAN,
  WARNING: COLORS.YELLOW,
} as const;

// Status Enums
export const STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  PENDING: 'PENDING',
} as const;

// Timeframes
export const TIMEFRAMES = {
  ANNUAL: 'annual',
  QUARTERLY: 'quarterly',
  MONTHLY: 'monthly',
  WEEKLY: 'weekly',
} as const;

// Goal Status
export const GOAL_STATUS = {
  ON_TRACK: 'ON_TRACK',
  BELOW_PACE: 'BELOW_PACE',
  EXCEEDED: 'EXCEEDED',
  WARNING: 'WARNING',
} as const;

// Animation Duration
export const ANIMATION_DURATION = '0.15s';

// Responsive Breakpoints
export const BREAKPOINTS = {
  MOBILE: 480,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE: 1280,
  XLARGE: 1536,
} as const;
