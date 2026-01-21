/**
 * Treasury Queries
 * Server-side data fetching functions for Treasury module
 * All queries enforce RLS at Supabase level (auth.uid() = user_id)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

import type {
  Account,
  TreasuryConfig,
  Trade,
} from './calculations';

/**
 * Treasury wallet type
 */
export interface TreasuryWallet {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  starting_balance: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Treasury transaction type
 */
export interface TreasuryTransaction {
  id: string;
  user_id: string;
  wallet_id: string;
  account_id?: string | null;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amount: number;
  occurred_on: string; // DATE
  description?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Treasury budget type
 */
export interface TreasuryBudget {
  id: string;
  user_id: string;
  wallet_id: string;
  period_start: string; // DATE
  period_end: string; // DATE
  target_income?: number | null;
  target_expense?: number | null;
  target_payout?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Treasury payout type
 */
export interface TreasuryPayout {
  id: string;
  user_id: string;
  account_id: string;
  wallet_id: string;
  payout_date: string; // DATE
  amount: number;
  status: 'planned' | 'sent' | 'received' | 'canceled';
  method?: string | null;
  notes?: string | null;
  // Payout engine fields (from migration 012)
  cycle_start?: string; // DATE
  cycle_expected_end?: string; // DATE
  calc_cutoff?: string; // DATE
  version?: number; // default 1
  cash_payout_amount?: number;
  tax_reserve_amount?: number;
  bonus_vault_amount?: number;
  blocked_reasons?: string[]; // JSONB array
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

/**
 * Get all accounts for current user (non-deleted)
 */
export async function getAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, account_size, current_balance, phase_status, withdrawals_enabled')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get accounts filtered by IDs
 */
export async function getAccountsByIds(ids: string[]): Promise<Account[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, account_size, current_balance, phase_status, withdrawals_enabled')
    .in('id', ids)
    .is('deleted_at', null);

  if (error) {
    console.error('Error fetching accounts by IDs:', error);
    return [];
  }

  return data || [];
}

/**
 * Get single account by ID
 */
export async function getAccount(id: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, account_size, current_balance, phase_status, withdrawals_enabled')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching account:', error);
    }
    return null;
  }

  return data || null;
}

/**
 * Get treasury config for a specific account (create default if missing)
 */
export async function getTreasuryConfig(
  accountId: string
): Promise<TreasuryConfig | null> {
  const { data, error } = await supabase
    .from('treasury_configs')
    .select('*')
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching treasury config:', error);
    }
    return null;
  }

  return data || null;
}

/**
 * Get all treasury configs for current user
 */
export async function getTreasuryConfigs(): Promise<TreasuryConfig[]> {
  const { data, error } = await supabase
    .from('treasury_configs')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching treasury configs:', error);
    return [];
  }

  return data || [];
}

/**
 * Create or update treasury config
 */
export async function upsertTreasuryConfig(
  accountId: string,
  config: Partial<TreasuryConfig>
): Promise<TreasuryConfig | null> {
  // First try to get existing config
  const existing = await getTreasuryConfig(accountId);

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('treasury_configs')
      .update({
        ...config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating treasury config:', error);
      return null;
    }

    return data || null;
  } else {
    // Create new (Supabase will fill user_id from auth context)
    const { data, error } = await supabase
      .from('treasury_configs')
      .insert({
        account_id: accountId,
        withdrawal_day: 1,
        split_mode: 'growth',
        anti_drawdown_active: false,
        anti_drawdown_threshold: 20,
        tax_buffer_percentage: 30,
        tax_buffer_accumulated: 0,
        milestone_bonus_vault: 0,
        ...config,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating treasury config:', error);
      return null;
    }

    return data || null;
  }
}

/**
 * Get closed trades for an account
 * Used for drawdown and health score calculations
 */
export async function getAccountTrades(accountId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('id, account_id, entry_date, exit_date, created_at, pnl, status')
    .eq('account_id', accountId)
    .eq('status', 'Closed')
    .is('deleted_at', null)
    .order('exit_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching account trades:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all closed trades for current user
 * Used for aggregated calculations
 */
export async function getAllTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('id, account_id, entry_date, exit_date, created_at, pnl, status')
    .eq('status', 'Closed')
    .is('deleted_at', null)
    .order('exit_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching all trades:', error);
    return [];
  }

  return data || [];
}

/**
 * Get treasury transactions for aggregation (optional for overview totals)
 */
export async function getTreasuryTransactions() {
  const { data, error } = await supabase
    .from('treasury_transactions')
    .select('*')
    .is('deleted_at', null)
    .order('occurred_on', { ascending: false });

  if (error) {
    console.error('Error fetching treasury transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get treasury payouts (for dashboard if needed)
 */
export async function getTreasuryPayouts() {
  const { data, error } = await supabase
    .from('treasury_payouts')
    .select('*')
    .eq('status', 'planned')
    .is('deleted_at', null)
    .order('payout_date', { ascending: true });

  if (error) {
    console.error('Error fetching treasury payouts:', error);
    return [];
  }

  return data || [];
}

/**
 * Soft-delete a treasury config
 */
export async function deleteTreasuryConfig(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('treasury_configs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting treasury config:', error);
    return false;
  }

  return true;
}

/**
 * Restore a treasury config (undo soft-delete)
 */
export async function restoreTreasuryConfig(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('treasury_configs')
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) {
    console.error('Error restoring treasury config:', error);
    return false;
  }

  return true;
}

/**
 * Get all wallets for current user
 */
export async function getWallets(): Promise<TreasuryWallet[]> {
  const { data, error } = await supabase
    .from('treasury_wallets')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching wallets:', error);
    return [];
  }

  return data || [];
}

/**
 * Get transactions for a wallet within optional date range
 */
export async function getTransactions(
  walletId: string,
  startDate?: string,
  endDate?: string
): Promise<TreasuryTransaction[]> {
  let query = supabase
    .from('treasury_transactions')
    .select('*')
    .eq('wallet_id', walletId)
    .is('deleted_at', null);

  if (startDate) {
    query = query.gte('occurred_on', startDate);
  }
  if (endDate) {
    query = query.lte('occurred_on', endDate);
  }

  const { data, error } = await query
    .order('occurred_on', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a treasury transaction
 */
export async function createTransaction(
  transaction: Omit<TreasuryTransaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<TreasuryTransaction | null> {
  const { data, error } = await supabase
    .from('treasury_transactions')
    .insert(transaction)
    .select()
    .single();

  if (error) {
    console.error('Error creating transaction:', error);
    return null;
  }

  return data || null;
}

/**
 * Update a treasury transaction
 */
export async function updateTransaction(
  id: string,
  updates: Partial<TreasuryTransaction>
): Promise<TreasuryTransaction | null> {
  const { data, error } = await supabase
    .from('treasury_transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating transaction:', error);
    return null;
  }

  return data || null;
}

/**
 * Delete (soft) a treasury transaction
 */
export async function deleteTransaction(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('treasury_transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }

  return true;
}

/**
 * Get budgets for a wallet
 */
export async function getBudgets(walletId: string): Promise<TreasuryBudget[]> {
  const { data, error } = await supabase
    .from('treasury_budgets')
    .select('*')
    .eq('wallet_id', walletId)
    .is('deleted_at', null)
    .order('period_start', { ascending: false });

  if (error) {
    console.error('Error fetching budgets:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a treasury budget
 */
export async function createBudget(
  budget: Omit<TreasuryBudget, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<TreasuryBudget | null> {
  const { data, error } = await supabase
    .from('treasury_budgets')
    .insert(budget)
    .select()
    .single();

  if (error) {
    console.error('Error creating budget:', error);
    return null;
  }

  return data || null;
}

/**
 * Update a treasury budget
 */
export async function updateBudget(
  id: string,
  updates: Partial<TreasuryBudget>
): Promise<TreasuryBudget | null> {
  const { data, error } = await supabase
    .from('treasury_budgets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating budget:', error);
    return null;
  }

  return data || null;
}

/**
 * Delete (soft) a treasury budget
 */
export async function deleteBudget(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('treasury_budgets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting budget:', error);
    return false;
  }

  return true;
}

/**
 * Get payouts for an account within optional date range
 */
export async function getPayouts(
  accountId?: string,
  startDate?: string,
  endDate?: string
): Promise<TreasuryPayout[]> {
  let query = supabase
    .from('treasury_payouts')
    .select('*')
    .is('deleted_at', null);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }
  if (startDate) {
    query = query.gte('payout_date', startDate);
  }
  if (endDate) {
    query = query.lte('payout_date', endDate);
  }

  const { data, error } = await query
    .order('payout_date', { ascending: false });

  if (error) {
    console.error('Error fetching payouts:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a treasury payout
 */
export async function createPayout(
  payout: Omit<TreasuryPayout, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<TreasuryPayout | null> {
  const { data, error } = await supabase
    .from('treasury_payouts')
    .insert(payout)
    .select()
    .single();

  if (error) {
    console.error('Error creating payout:', error);
    return null;
  }

  return data || null;
}

/**
 * Update a treasury payout
 */
export async function updatePayout(
  id: string,
  updates: Partial<TreasuryPayout>
): Promise<TreasuryPayout | null> {
  const { data, error } = await supabase
    .from('treasury_payouts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating payout:', error);
    return null;
  }

  return data || null;
}

/**
 * Delete (soft) a treasury payout
 */
export async function deletePayout(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('treasury_payouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error deleting payout:', error);
    return false;
  }

  return true;
}

/**
 * Get all treasury transactions across all wallets
 * Used by Treasury page to display all activity
 */
export async function getAllTransactions(
  startDate?: string,
  endDate?: string
): Promise<TreasuryTransaction[]> {
  let query = supabase
    .from('treasury_transactions')
    .select('*')
    .is('deleted_at', null)
    .order('occurred_on', { ascending: false });

  if (startDate) {
    query = query.gte('occurred_on', startDate);
  }

  if (endDate) {
    query = query.lte('occurred_on', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all transactions:', error);
    return [];
  }

  return data as TreasuryTransaction[];
}

/**
 * Get all treasury budgets across all wallets
 * Used by Treasury page to display all budget information
 */
export async function getAllBudgets(): Promise<TreasuryBudget[]> {
  const { data, error } = await supabase
    .from('treasury_budgets')
    .select('*')
    .is('deleted_at', null)
    .order('period_start', { ascending: false });

  if (error) {
    console.error('Error fetching all budgets:', error);
    return [];
  }

  return data as TreasuryBudget[];
}

/**
 * Get all treasury payouts across all accounts
 * Used by Treasury page to display all payout information
 */
export async function getAllPayouts(
  startDate?: string,
  endDate?: string
): Promise<TreasuryPayout[]> {
  let query = supabase
    .from('treasury_payouts')
    .select('*')
    .is('deleted_at', null)
    .order('scheduled_for', { ascending: false });

  if (startDate) {
    query = query.gte('scheduled_for', startDate);
  }

  if (endDate) {
    query = query.lte('scheduled_for', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all payouts:', error);
    return [];
  }

  return data as TreasuryPayout[];
}
