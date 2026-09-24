/**
 * ADHD Social Leaderboards — Clans, Hall of Fame, Rare Badges
 * 100% client-side, localStorage only
 */

export interface Clan {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  members: string[]; // userIds
  totalXp: number;
  wins: number;
}

export interface ClanMember {
  userId: string;
  clanId: string;
  joinedAt: number;
  xpContributed: number;
}

export interface HallOfFameEntry {
  timestamp: number;
  level: number;
  xp: number;
  hackerRankTitle: string;
  achievement: string; // "Level 50 Reached", "Perfect Week", etc.
}

export interface RareBadge {
  id: string;
  name: string;
  icon: string;
  rarity: "legendary" | "epic" | "rare";
  condition: string;
  unlockedAt: number | null;
}

const STORAGE_KEY_CLANS = "cybersec_clans";
const STORAGE_KEY_USER_CLAN = "cybersec_user_clan";
const STORAGE_KEY_HALL_OF_FAME = "cybersec_hall_of_fame";
const STORAGE_KEY_RARE_BADGES = "cybersec_rare_badges";

const CLAN_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#BB8FCE", // Purple
];

/**
 * Generate unique clan ID
 */
export function generateClanId(): string {
  return `clan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new clan
 */
export function createClan(name: string, userId: string): Clan {
  const clan: Clan = {
    id: generateClanId(),
    name,
    color: CLAN_COLORS[Math.floor(Math.random() * CLAN_COLORS.length)],
    createdAt: Date.now(),
    members: [userId],
    totalXp: 0,
    wins: 0,
  };

  const clans = getAllClans();
  clans.push(clan);
  localStorage.setItem(STORAGE_KEY_CLANS, JSON.stringify(clans));

  localStorage.setItem(STORAGE_KEY_USER_CLAN, JSON.stringify({ userId, clanId: clan.id }));

  return clan;
}

/**
 * Get all clans
 */
export function getAllClans(): Clan[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CLANS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get user's clan
 */
export function getUserClan(userId: string): Clan | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USER_CLAN);
    if (!data) return null;

    const { clanId } = JSON.parse(data);
    const clans = getAllClans();
    return clans.find((c) => c.id === clanId) || null;
  } catch {
    return null;
  }
}

/**
 * Join a clan
 */
export function joinClan(userId: string, clanId: string): boolean {
  const clans = getAllClans();
  const clan = clans.find((c) => c.id === clanId);

  if (!clan || clan.members.includes(userId)) return false;

  clan.members.push(userId);
  localStorage.setItem(STORAGE_KEY_CLANS, JSON.stringify(clans));
  localStorage.setItem(STORAGE_KEY_USER_CLAN, JSON.stringify({ userId, clanId }));

  return true;
}

/**
 * Leave clan
 */
export function leaveClan(userId: string): void {
  const clans = getAllClans();
  const clanToUpdate = clans.find((c) => c.members.includes(userId));

  if (clanToUpdate) {
    clanToUpdate.members = clanToUpdate.members.filter((m) => m !== userId);
    localStorage.setItem(STORAGE_KEY_CLANS, JSON.stringify(clans));
  }

  localStorage.removeItem(STORAGE_KEY_USER_CLAN);
}

/**
 * Add XP to clan (called after every quiz)
 */
export function addXpToClan(clanId: string, xp: number): void {
  const clans = getAllClans();
  const clan = clans.find((c) => c.id === clanId);

  if (clan) {
    clan.totalXp += xp;
    localStorage.setItem(STORAGE_KEY_CLANS, JSON.stringify(clans));
  }
}

/**
 * Get clan leaderboard (sorted by total XP)
 */
export function getClanLeaderboard(): Clan[] {
  return getAllClans().sort((a, b) => b.totalXp - a.totalXp);
}

/**
 * Get user's percentile in clan competition
 * (simulated: based on number of clans and XP distribution)
 */
export function getUserClanPercentile(userId: string, clan: Clan): number {
  const allClans = getAllClans();
  const userClanRank = allClans.findIndex((c) => c.id === clan.id) + 1;
  const percentile = Math.max(0, 100 - (userClanRank / allClans.length) * 100);

  return Math.round(percentile);
}

/**
 * Hall of Fame: Add achievement record
 */
export function recordAchievement(
  level: number,
  xp: number,
  hackerRankTitle: string,
  achievement: string
): void {
  const hallOfFame = getHallOfFame();

  const entry: HallOfFameEntry = {
    timestamp: Date.now(),
    level,
    xp,
    hackerRankTitle,
    achievement,
  };

  hallOfFame.push(entry);

  // Keep only last 100 entries
  if (hallOfFame.length > 100) {
    hallOfFame.shift();
  }

  localStorage.setItem(STORAGE_KEY_HALL_OF_FAME, JSON.stringify(hallOfFame));
}

/**
 * Get Hall of Fame entries (most recent first)
 */
export function getHallOfFame(): HallOfFameEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_HALL_OF_FAME);
    return data ? JSON.parse(data).reverse() : [];
  } catch {
    return [];
  }
}

/**
 * Initialize rare badges catalog
 */
export function initializeRareBadges(): RareBadge[] {
  const badges: RareBadge[] = [
    {
      id: "perfect_week",
      name: "Perfect Week",
      icon: "⚡",
      rarity: "epic",
      condition: "7-day streak with 100% accuracy",
      unlockedAt: null,
    },
    {
      id: "speedrun_champion",
      name: "Speedrun Champion",
      icon: "🏎️",
      rarity: "epic",
      condition: "Average time <15s per question for 20 questions",
      unlockedAt: null,
    },
    {
      id: "comeback_king",
      name: "Comeback King",
      icon: "💪",
      rarity: "rare",
      condition: "Recover from 0% accuracy to 80%+ in single session",
      unlockedAt: null,
    },
    {
      id: "legendary_learner",
      name: "Legendary Learner",
      icon: "👑",
      rarity: "legendary",
      condition: "Reach level 50 Hacker Rank",
      unlockedAt: null,
    },
    {
      id: "streak_collector",
      name: "Streak Collector",
      icon: "🔥",
      rarity: "rare",
      condition: "Maintain 30-day streak",
      unlockedAt: null,
    },
    {
      id: "hint_master",
      name: "Hint Master",
      icon: "💡",
      rarity: "rare",
      condition: "Solve 50 questions with scaffolding enabled",
      unlockedAt: null,
    },
    {
      id: "clan_champion",
      name: "Clan Champion",
      icon: "🏆",
      rarity: "epic",
      condition: "Help clan reach top 3 in leaderboard",
      unlockedAt: null,
    },
  ];

  localStorage.setItem(STORAGE_KEY_RARE_BADGES, JSON.stringify(badges));
  return badges;
}

/**
 * Get rare badges (initialize if not present)
 */
export function getRareBadges(): RareBadge[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_RARE_BADGES);
    return data ? JSON.parse(data) : initializeRareBadges();
  } catch {
    return initializeRareBadges();
  }
}

/**
 * Detect and unlock rare badges based on performance
 */
export interface BadgeDetectionContext {
  currentStreak: number;
  accuracy: number;
  consecutiveWrong: number;
  avgTimePerQuestion: number;
  hackerLevel: number;
  questionsAnsweredThisSession: number;
  clanRank: number | null;
}

export function detectAndUnlockRareBadges(context: BadgeDetectionContext): RareBadge[] {
  const badges = getRareBadges();
  const unlockedThisSession: RareBadge[] = [];

  // Perfect Week
  if (context.currentStreak >= 7 && context.accuracy >= 1.0) {
    const badge = badges.find((b) => b.id === "perfect_week");
    if (badge && !badge.unlockedAt) {
      badge.unlockedAt = Date.now();
      unlockedThisSession.push(badge);
    }
  }

  // Speedrun Champion
  if (context.questionsAnsweredThisSession >= 20 && context.avgTimePerQuestion < 15) {
    const badge = badges.find((b) => b.id === "speedrun_champion");
    if (badge && !badge.unlockedAt) {
      badge.unlockedAt = Date.now();
      unlockedThisSession.push(badge);
    }
  }

  // Comeback King
  if (
    context.questionsAnsweredThisSession >= 5 &&
    context.accuracy >= 0.8 &&
    context.consecutiveWrong === 0
  ) {
    const badge = badges.find((b) => b.id === "comeback_king");
    if (badge && !badge.unlockedAt) {
      badge.unlockedAt = Date.now();
      unlockedThisSession.push(badge);
    }
  }

  // Legendary Learner
  if (context.hackerLevel >= 50) {
    const badge = badges.find((b) => b.id === "legendary_learner");
    if (badge && !badge.unlockedAt) {
      badge.unlockedAt = Date.now();
      unlockedThisSession.push(badge);
    }
  }

  // Streak Collector
  if (context.currentStreak >= 30) {
    const badge = badges.find((b) => b.id === "streak_collector");
    if (badge && !badge.unlockedAt) {
      badge.unlockedAt = Date.now();
      unlockedThisSession.push(badge);
    }
  }

  // Clan Champion
  if (context.clanRank !== null && context.clanRank <= 3) {
    const badge = badges.find((b) => b.id === "clan_champion");
    if (badge && !badge.unlockedAt) {
      badge.unlockedAt = Date.now();
      unlockedThisSession.push(badge);
    }
  }

  if (unlockedThisSession.length > 0) {
    localStorage.setItem(STORAGE_KEY_RARE_BADGES, JSON.stringify(badges));
  }

  return unlockedThisSession;
}

/**
 * Get unlocked rare badges only
 */
export function getUnlockedRareBadges(): RareBadge[] {
  return getRareBadges().filter((b) => b.unlockedAt !== null);
}
