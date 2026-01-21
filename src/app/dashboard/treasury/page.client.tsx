/**
 * Treasury Page Client Component
 * Displays treasury overview with account selector and config management
 * 
 * Note: Uses standard HTML elements (no lucide-react) and Supabase
 * data passed from server component (no React Query).
 * 
 * Offline Support: Falls back to IndexedDB snapshot when offline or no session
 */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import TreasuryTabs from '@/components/treasury/TreasuryTabs.client';
import { getOfflineSnapshot, saveTreasurySnapshot, isOffline, hasSession } from '@/lib/offline/snapshot';
import type { Account, TreasuryConfig, Trade } from '@/lib/treasury/calculations';
import type { TreasuryTransaction, TreasuryPayout, TreasuryBudget } from '@/lib/treasury/queries';

// Props passed from server component
interface TreasuryPageClientProps {
  accounts?: Account[];
  configs?: TreasuryConfig[];
  trades?: Trade[];
  transactions?: TreasuryTransaction[];
  payouts?: TreasuryPayout[];
  budgets?: TreasuryBudget[];
  error?: string | null;
}

export default function TreasuryPageClient({
  accounts: serverAccounts = [],
  configs: serverConfigs = [],
  trades: serverTrades = [],
  transactions: serverTransactions = [],
  payouts: serverPayouts = [],
  budgets: serverBudgets = [],
  error: serverError = null,
}: TreasuryPageClientProps) {
  const [accounts, setAccounts] = useState<Account[]>(serverAccounts);
  const [configs, setConfigs] = useState<TreasuryConfig[]>(serverConfigs);
  const [trades, setTrades] = useState<Trade[]>(serverTrades as Trade[]);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>(
    serverTransactions as TreasuryTransaction[]
  );
  const [payouts, setPayouts] = useState<TreasuryPayout[]>(serverPayouts as TreasuryPayout[]);
  const [budgets, setBudgets] = useState<TreasuryBudget[]>(serverBudgets as TreasuryBudget[]);
  const [error, setError] = useState<string | null>(serverError);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Save data to snapshot when online with session, and load offline data
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Check if we have valid session
        const hasValidSession = hasSession();
        const offline = isOffline();

        if (hasValidSession && !offline) {
          // Save data to snapshot for offline use
          await saveTreasurySnapshot({
            accounts,
            configs,
            wallets: [],
            transactions,
            budgets,
            payouts,
            trades,
          });
        } else if (offline || !hasValidSession) {
          // Try to load from offline snapshot
          const snapshot = await getOfflineSnapshot();
          if (snapshot?.treasury) {
            const treasury = snapshot.treasury;
            setAccounts((treasury.accounts || []) as Account[]);
            setConfigs((treasury.configs || []) as TreasuryConfig[]);
            setTrades((treasury.trades || []) as Trade[]);
            setTransactions((treasury.transactions || []) as TreasuryTransaction[]);
            setPayouts((treasury.payouts || []) as TreasuryPayout[]);
            setBudgets((treasury.budgets || []) as TreasuryBudget[]);
            setIsOfflineMode(true);
            setError(offline ? '📡 Offline Mode - Data is read-only' : '🔐 No Session - Showing cached data');
          }
        }
      } catch (err) {
        console.error('Error initializing treasury data:', err);
      }
    };

    initializeData();
  }, [accounts, configs, trades, transactions, payouts, budgets]);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Link
                href="/dashboard"
                className="text-slate-400 hover:text-white text-sm flex items-center gap-2"
              >
                ← Back
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white">Treasury</h1>
            <p className="text-slate-400 mt-1">
              Manage withdrawals, distributions, and protections by account
              {isOfflineMode && ' (Read-Only)'}
            </p>
          </div>
        </div>

        {/* Status Banner */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg border ${
            isOfflineMode
              ? 'bg-blue-900/20 border-blue-500/30'
              : 'bg-red-900/20 border-red-500/30'
          }`}>
            <p className={isOfflineMode ? 'text-blue-400 text-sm' : 'text-red-400 text-sm'}>
              {error}
            </p>
          </div>
        )}

        {/* Treasury Tabs */}
        <TreasuryTabs
          accounts={accounts}
          configs={configs}
          trades={trades}
          transactions={transactions}
          payouts={payouts}
          budgets={budgets}
        />
      </div>
    </div>
  );
}
