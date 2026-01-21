/**
 * AlphaCore Query Keys
 * Standardized query key factory for React Query
 * Ensures consistent cache keys across the app
 */

import type { ModuleName, SubsectionName } from './moduleRegistry';
import type { QueryKey } from './types';

/**
 * Query key factory
 * Creates consistent, typed query keys for React Query
 */
export const queryKeys = {
  /**
   * List queries - fetches multiple entities
   * @example queryKeys.list('tradehub', 'accounts', { trash: false })
   */
  list: (
    module: ModuleName,
    table: string,
    filters?: Record<string, any>,
    subsection?: SubsectionName
  ): QueryKey => ({
    scope: 'list',
    module,
    table,
    subsection,
    filters: filters ?? {}
  }),

  /**
   * Detail queries - fetches single entity by ID
   * @example queryKeys.detail('tradehub', 'accounts', '123e4567-e89b-12d3-a456-426614174000')
   */
  detail: (
    module: ModuleName,
    table: string,
    entityId: string,
    subsection?: SubsectionName
  ): QueryKey => ({
    scope: 'detail',
    module,
    table,
    entityId,
    subsection
  }),

  /**
   * Aggregate queries - fetches computed data (counts, sums, etc.)
   * @example queryKeys.aggregate('business', 'business_costs', { period: '2024-01' })
   */
  aggregate: (
    module: ModuleName,
    table: string,
    filters?: Record<string, any>,
    subsection?: SubsectionName
  ): QueryKey => ({
    scope: 'aggregate',
    module,
    table,
    subsection,
    filters: filters ?? {}
  })
};

/**
 * Helper to serialize query key to array format (React Query)
 * @example serializeKey(queryKeys.list('tradehub', 'accounts')) 
 * // => ['list', 'tradehub', 'accounts', {}]
 */
export function serializeKey(key: QueryKey): (string | Record<string, any>)[] {
  const parts: (string | Record<string, any>)[] = [key.scope, key.module, key.table];
  
  if (key.subsection) {
    parts.push(key.subsection);
  }
  
  if (key.entityId) {
    parts.push(key.entityId);
  }
  
  if (key.filters && Object.keys(key.filters).length > 0) {
    parts.push(key.filters);
  }
  
  return parts;
}

/**
 * Get invalidation pattern for a table
 * Returns array of query key patterns to invalidate
 * @example getInvalidationPattern('tradehub', 'accounts')
 * // => [['list', 'tradehub', 'accounts'], ['aggregate', 'tradehub', 'accounts']]
 */
export function getInvalidationPattern(
  module: ModuleName,
  table: string,
  subsection?: SubsectionName
): (string | Record<string, any>)[][] {
  const listKey = queryKeys.list(module, table, undefined, subsection);
  const aggregateKey = queryKeys.aggregate(module, table, undefined, subsection);
  
  return [
    serializeKey(listKey),
    serializeKey(aggregateKey)
  ];
}

/**
 * Check if a query key matches a pattern
 * Used for selective invalidation
 */
export function matchesPattern(
  key: (string | Record<string, any>)[], 
  pattern: (string | Record<string, any>)[]
): boolean {
  if (pattern.length > key.length) return false;
  
  for (let i = 0; i < pattern.length; i++) {
    if (typeof pattern[i] === 'object' && pattern[i] !== null && 
        typeof key[i] === 'object' && key[i] !== null) {
      // Partial object match
      const patternObj = pattern[i] as Record<string, any>;
      const keyObj = key[i] as Record<string, any>;
      const patternKeys = Object.keys(patternObj);
      const matches = patternKeys.every(
        pk => patternObj[pk] === keyObj[pk]
      );
      if (!matches) return false;
    } else if (pattern[i] !== key[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Pre-defined query key constants for common queries
 */
export const commonQueries = {
  // TradeHub
  accounts: {
    list: () => queryKeys.list('tradehub', 'accounts'),
    listTrash: () => queryKeys.list('tradehub', 'accounts', { trash: true }),
    detail: (id: string) => queryKeys.detail('tradehub', 'accounts', id)
  },
  
  accountCategories: {
    list: () => queryKeys.list('tradehub', 'account_categories'),
  },
  
  trades: {
    list: (accountId?: string) => 
      queryKeys.list('tradehub', 'trades', accountId ? { accountId } : undefined),
    listTrash: () => queryKeys.list('tradehub', 'trades', { trash: true }),
    detail: (id: string) => queryKeys.detail('tradehub', 'trades', id)
  },
  
  setups: {
    list: () => queryKeys.list('tradehub', 'setups'),
    detail: (id: string) => queryKeys.detail('tradehub', 'setups', id)
  },
  
  weeklyReports: {
    list: () => queryKeys.list('tradehub', 'weekly_reports'),
    detail: (id: string) => queryKeys.detail('tradehub', 'weekly_reports', id)
  },
  
  // Logs
  logs: {
    list: (filters?: Record<string, any>) => queryKeys.list('logs', 'logs', filters),
    listTrash: () => queryKeys.list('logs', 'logs', { trash: true }),
    detail: (id: string) => queryKeys.detail('logs', 'logs', id)
  },
  
  categories: {
    list: () => queryKeys.list('logs', 'categories')
  },
  
  tags: {
    list: () => queryKeys.list('logs', 'tags')
  },
  
  // Terminal
  instruments: {
    list: () => queryKeys.list('terminal', 'instruments')
  },
  
  terminalNews: {
    list: (instrumentId?: string) =>
      queryKeys.list('terminal', 'terminal_news', instrumentId ? { instrumentId } : undefined),
    detail: (id: string) => queryKeys.detail('terminal', 'terminal_news', id)
  },
  
  terminalEvents: {
    list: (instrumentId?: string) =>
      queryKeys.list('terminal', 'terminal_events', instrumentId ? { instrumentId } : undefined),
    detail: (id: string) => queryKeys.detail('terminal', 'terminal_events', id)
  },
  
  // Treasury
  treasuryConfigs: {
    list: () => queryKeys.list('treasury', 'treasury_configs'),
    detail: (id: string) => queryKeys.detail('treasury', 'treasury_configs', id)
  },
  
  treasuryWallets: {
    list: () => queryKeys.list('treasury', 'treasury_wallets'),
    detail: (id: string) => queryKeys.detail('treasury', 'treasury_wallets', id)
  },
  
  treasuryTransactions: {
    list: (filters?: Record<string, any>) =>
      queryKeys.list('treasury', 'treasury_transactions', filters),
    aggregate: (filters?: Record<string, any>) =>
      queryKeys.aggregate('treasury', 'treasury_transactions', filters)
  },
  
  // Business
  businessCosts: {
    list: (filters?: Record<string, any>) =>
      queryKeys.list('business', 'business_costs', filters),
    aggregate: (filters?: Record<string, any>) =>
      queryKeys.aggregate('business', 'business_costs', filters)
  },
  
  businessMilestones: {
    list: () => queryKeys.list('business', 'business_milestones'),
    detail: (id: string) => queryKeys.detail('business', 'business_milestones', id)
  },
  
  businessSOPs: {
    list: () => queryKeys.list('business', 'business_sops'),
    detail: (id: string) => queryKeys.detail('business', 'business_sops', id)
  },
  
  // TraderMap
  traderMapLevel: {
    current: () => queryKeys.detail('tradermap', 'tradermap_user_level', 'current')
  },
  
  traderMapGoals: {
    list: () => queryKeys.list('tradermap', 'tradermap_goals'),
    detail: (id: string) => queryKeys.detail('tradermap', 'tradermap_goals', id)
  },
  
  // AlphaShield
  appLogs: {
    list: (filters?: Record<string, any>) =>
      queryKeys.list('logs', 'app_logs', filters),
    topBugs: () =>
      queryKeys.aggregate('logs', 'app_logs', { groupBy: 'fingerprint', days: 7 })
  }
};
