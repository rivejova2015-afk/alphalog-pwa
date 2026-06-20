/**
 * AlphaCore Module Registry
 * Central registry of all app modules and their subsections
 * Derived from APP_MAP.md and actual routes in /src/app/dashboard
 */

export type ModuleName =
  | 'logs'
  | 'terminal'
  | 'tradehub'
  | 'journal'
  | 'treasury'
  | 'business';

export type SubsectionName = 
  // TradeHub subsections
  | 'accounts'
  | 'newTradesLog'
  | 'evidenceVault'
  | 'playbook'
  | 'reports'
  // Treasury subsections
  | 'overview'
  | 'milestone'
  | 'cashflow'
  | 'calendario'
  | 'splits'
  | 'umbral'
  | 'antiDD'
  | 'heatmap'
  // Business subsections
  | 'health'
  | 'kpis'
  | 'pl'
  | 'runway'
  | 'roadmap'
  | 'sops'
  | 'decisions'
  | 'llc';

export interface ModuleDefinition {
  name: ModuleName;
  displayName: string;
  route: string;
  hasSubsections: boolean;
  subsections?: SubsectionDefinition[];
  tables: string[]; // DB tables this module owns
}

export interface SubsectionDefinition {
  name: SubsectionName;
  displayName: string;
  tables: string[];
}

/**
 * Complete module registry
 * Matches /src/app/dashboard/* structure and DB schema
 */
export const MODULE_REGISTRY: Record<ModuleName, ModuleDefinition> = {
  logs: {
    name: 'logs',
    displayName: 'Logs Manager',
    route: '/dashboard/logs',
    hasSubsections: false,
    tables: ['categories', 'tags', 'logs', 'log_tags', 'log_attachments']
  },
  
  terminal: {
    name: 'terminal',
    displayName: 'Terminal',
    route: '/dashboard/terminal',
    hasSubsections: false,
    tables: ['instruments', 'terminal_news', 'terminal_events', 'terminal_evidence_reports', 'terminal_evidence_attachments']
  },
  
  tradehub: {
    name: 'tradehub',
    displayName: 'TradeHub',
    route: '/dashboard/tradehub',
    hasSubsections: true,
    tables: ['account_categories', 'accounts', 'setups', 'trades', 'tv_analysis_evidence', 'weekly_reports'],
    subsections: [
      {
        name: 'accounts',
        displayName: 'Accounts',
        tables: ['account_categories', 'accounts']
      },
      {
        name: 'newTradesLog',
        displayName: 'New Trades Log',
        tables: ['trades', 'setups']
      },
      {
        name: 'evidenceVault',
        displayName: 'Evidence Vault',
        tables: ['tv_analysis_evidence']
      },
      {
        name: 'playbook',
        displayName: 'Playbook',
        tables: ['setups', 'trades']
      },
      {
        name: 'reports',
        displayName: 'Reports',
        tables: ['weekly_reports', 'trades']
      }
    ]
  },
  
  journal: {
    name: 'journal',
    displayName: 'Journal PT',
    route: '/dashboard/journal',
    hasSubsections: false,
    tables: ['logs'] // Reuses logs table with specific category
  },
  
  treasury: {
    name: 'treasury',
    displayName: 'Treasury',
    route: '/dashboard/treasury',
    hasSubsections: true,
    tables: ['treasury_configs', 'treasury_wallets', 'treasury_transactions', 'treasury_budgets', 'treasury_payouts', 'treasury_calendar_events'],
    subsections: [
      {
        name: 'overview',
        displayName: 'Overview',
        tables: ['treasury_configs', 'treasury_wallets', 'treasury_transactions']
      },
      {
        name: 'milestone',
        displayName: 'Milestone',
        tables: ['treasury_configs']
      },
      {
        name: 'cashflow',
        displayName: 'Cashflow',
        tables: ['treasury_transactions', 'treasury_payouts']
      },
      {
        name: 'calendario',
        displayName: 'Calendario',
        tables: ['treasury_calendar_events', 'treasury_configs']
      },
      {
        name: 'splits',
        displayName: 'Splits',
        tables: ['treasury_configs']
      },
      {
        name: 'umbral',
        displayName: 'Umbral',
        tables: ['treasury_configs']
      },
      {
        name: 'antiDD',
        displayName: 'Anti-DD',
        tables: ['treasury_configs']
      },
      {
        name: 'heatmap',
        displayName: 'Heatmap',
        tables: ['treasury_transactions']
      }
    ]
  },
  
  business: {
    name: 'business',
    displayName: 'Business',
    route: '/dashboard/business',
    hasSubsections: true,
    tables: ['business_costs', 'business_cost_templates', 'business_milestones', 'business_sops', 'business_sop_items', 'business_sop_runs', 'business_sop_run_items', 'business_decision_tasks', 'business_llc_info'],
    subsections: [
      {
        name: 'health',
        displayName: 'Health',
        tables: ['business_costs', 'trades']
      },
      {
        name: 'kpis',
        displayName: 'KPIs',
        tables: ['business_costs', 'trades']
      },
      {
        name: 'pl',
        displayName: 'P&L',
        tables: ['business_costs', 'trades']
      },
      {
        name: 'runway',
        displayName: 'Runway',
        tables: ['business_costs', 'trades']
      },
      {
        name: 'roadmap',
        displayName: 'Roadmap',
        tables: ['business_milestones']
      },
      {
        name: 'sops',
        displayName: 'SOPs',
        tables: ['business_sops', 'business_sop_items', 'business_sop_runs', 'business_sop_run_items']
      },
      {
        name: 'decisions',
        displayName: 'Decisions',
        tables: ['business_decision_tasks']
      },
      {
        name: 'llc',
        displayName: 'LLC',
        tables: ['business_llc_info']
      }
    ]
  }
};

/**
 * Get module definition by name
 */
export function getModule(name: ModuleName): ModuleDefinition {
  return MODULE_REGISTRY[name];
}

/**
 * Get all tables for a module (including subsections)
 */
export function getModuleTables(name: ModuleName): string[] {
  return MODULE_REGISTRY[name].tables;
}

/**
 * Get subsection definition
 */
export function getSubsection(moduleName: ModuleName, subsectionName: SubsectionName): SubsectionDefinition | undefined {
  const moduleDefinition = MODULE_REGISTRY[moduleName];
  return moduleDefinition.subsections?.find(s => s.name === subsectionName);
}

/**
 * Find which module owns a table
 */
export function findModuleForTable(tableName: string): ModuleName | null {
  for (const [moduleName, module] of Object.entries(MODULE_REGISTRY)) {
    if (module.tables.includes(tableName)) {
      return moduleName as ModuleName;
    }
  }
  return null;
}
