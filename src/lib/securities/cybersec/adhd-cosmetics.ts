/**
 * ADHD Cosmetics System — Visual Rewards & Achievement Progression
 * Cosmetics prevent hedonic adaptation by rotating reward types weekly
 */

export type CosmeticType = "badge" | "title" | "gear" | "theme";
export type CosmeticRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Cosmetic {
  id: string;
  type: CosmeticType;
  name: string;
  description: string;
  rarity: CosmeticRarity;
  emoji: string;
  unlockedAt?: Date;
  isEquipped?: boolean;
}

export interface UserCosmetics {
  equippedBadges: string[];
  equippedTitle?: string;
  equippedGear: string[];
  equippedTheme?: string;
}

/**
 * Badge catalog - unlocked every 5 quizzes during that week's badge rotation
 */
export const BADGE_CATALOG: Cosmetic[] = [
  {
    id: "badge-first-five",
    type: "badge",
    name: "First Steps",
    description: "Answered 5 questions",
    rarity: "common",
    emoji: "👶",
  },
  {
    id: "badge-quick-study",
    type: "badge",
    name: "Quick Study",
    description: "Completed 5 quizzes in one day",
    rarity: "uncommon",
    emoji: "⚡",
  },
  {
    id: "badge-perfect-day",
    type: "badge",
    name: "Perfect Day",
    description: "100% accuracy on all quizzes today",
    rarity: "rare",
    emoji: "🎯",
  },
  {
    id: "badge-week-warrior",
    type: "badge",
    name: "Week Warrior",
    description: "7-day streak maintained",
    rarity: "uncommon",
    emoji: "🗡️",
  },
  {
    id: "badge-month-master",
    type: "badge",
    name: "Month Master",
    description: "30-day streak maintained",
    rarity: "rare",
    emoji: "🏆",
  },
  {
    id: "badge-network-ninja",
    type: "badge",
    name: "Network Ninja",
    description: "Completed all Network Security quizzes",
    rarity: "epic",
    emoji: "🥷",
  },
  {
    id: "badge-crypto-crusader",
    type: "badge",
    name: "Crypto Crusader",
    description: "Mastered Cryptography module",
    rarity: "epic",
    emoji: "🔐",
  },
];

/**
 * Title cosmetics - achievements that show on profile
 */
export const TITLE_CATALOG: Cosmetic[] = [
  {
    id: "title-novice",
    type: "title",
    name: "Novice Hacker",
    description: "Reached level 1",
    rarity: "common",
    emoji: "🤓",
  },
  {
    id: "title-analyst",
    type: "title",
    name: "Security Analyst",
    description: "Level 5 achieved",
    rarity: "uncommon",
    emoji: "🔍",
  },
  {
    id: "title-engineer",
    type: "title",
    name: "Security Engineer",
    description: "Level 10 achieved",
    rarity: "rare",
    emoji: "⚙️",
  },
  {
    id: "title-architect",
    type: "title",
    name: "Security Architect",
    description: "Level 15 achieved",
    rarity: "epic",
    emoji: "🏗️",
  },
  {
    id: "title-elite",
    type: "title",
    name: "Elite Operator",
    description: "Level 20 achieved",
    rarity: "legendary",
    emoji: "👑",
  },
];

/**
 * Gear cosmetics - visual elements that appear in profile
 */
export const GEAR_CATALOG: Cosmetic[] = [
  {
    id: "gear-hacker-hood",
    type: "gear",
    name: "Hacker Hoodie",
    description: "Classic cybersecurity aesthetic",
    rarity: "common",
    emoji: "👕",
  },
  {
    id: "gear-matrix-glasses",
    type: "gear",
    name: "Matrix Glasses",
    description: "See the Matrix",
    rarity: "uncommon",
    emoji: "🕶️",
  },
  {
    id: "gear-encrypted-ring",
    type: "gear",
    name: "Encrypted Ring",
    description: "RSA-2048 on your finger",
    rarity: "rare",
    emoji: "💍",
  },
  {
    id: "gear-platinum-badge",
    type: "gear",
    name: "Platinum Badge",
    description: "Prestigious security clearance",
    rarity: "epic",
    emoji: "🎖️",
  },
];

/**
 * Theme cosmetics - UI theme variations
 */
export const THEME_CATALOG: Cosmetic[] = [
  {
    id: "theme-default",
    type: "theme",
    name: "Default",
    description: "Original AlphaLog colors",
    rarity: "common",
    emoji: "🎨",
  },
  {
    id: "theme-neon",
    type: "theme",
    name: "Neon Nights",
    description: "Cyberpunk aesthetic",
    rarity: "uncommon",
    emoji: "⚡",
  },
  {
    id: "theme-forest",
    type: "theme",
    name: "Forest Green",
    description: "Calm greens & earth tones",
    rarity: "uncommon",
    emoji: "🌲",
  },
  {
    id: "theme-ocean",
    type: "theme",
    name: "Ocean Blue",
    description: "Cool water vibes",
    rarity: "rare",
    emoji: "🌊",
  },
];

/**
 * Weekly reward rotation system - prevents hedonic adaptation
 * Each week, a different cosmetic type is the primary reward
 */
export type WeeklyRewardType = "badge" | "title" | "gear" | "theme";

export function getWeeklyRewardType(week: number): WeeklyRewardType {
  const types: WeeklyRewardType[] = ["badge", "title", "gear", "theme"];
  return types[week % 4];
}

export function getWeeklyRewardLabel(week: number): string {
  const type = getWeeklyRewardType(week);
  const labels: Record<WeeklyRewardType, string> = {
    badge: "This week: Badges 🏅",
    title: "This week: Titles 👑",
    gear: "This week: Gear 🎽",
    theme: "This week: Themes 🎨",
  };
  return labels[type];
}

/**
 * Rarity color system for UI
 */
export function getRarityColor(rarity: CosmeticRarity): string {
  const colors: Record<CosmeticRarity, string> = {
    common: "text-slate-400",
    uncommon: "text-green-400",
    rare: "text-blue-400",
    epic: "text-purple-400",
    legendary: "text-yellow-400",
  };
  return colors[rarity];
}

export function getRarityBgColor(rarity: CosmeticRarity): string {
  const colors: Record<CosmeticRarity, string> = {
    common: "bg-slate-500/20 border-slate-500/40",
    uncommon: "bg-green-500/20 border-green-500/40",
    rare: "bg-blue-500/20 border-blue-500/40",
    epic: "bg-purple-500/20 border-purple-500/40",
    legendary: "bg-yellow-500/20 border-yellow-500/40",
  };
  return colors[rarity];
}

/**
 * Get all cosmetics by type
 */
export function getCosmeticsByType(type: CosmeticType): Cosmetic[] {
  switch (type) {
    case "badge":
      return BADGE_CATALOG;
    case "title":
      return TITLE_CATALOG;
    case "gear":
      return GEAR_CATALOG;
    case "theme":
      return THEME_CATALOG;
  }
}
