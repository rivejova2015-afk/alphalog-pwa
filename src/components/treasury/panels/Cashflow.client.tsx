'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TreasuryTransaction, TreasuryPayout, TreasuryBudget } from '@/lib/treasury/queries';
import { formatCurrency, formatDate } from '@/lib/treasury/calculations';

interface Account {
  id: string;
  name: string;
  account_size: number;
  current_balance: number;
  phase_status?: string;
  withdrawals_enabled: boolean;
}

interface CashflowPanelProps {
  transactions: TreasuryTransaction[];
  payouts: TreasuryPayout[];
  budgets: TreasuryBudget[];
  accounts?: Account[];
}

export default function CashflowPanel({
  transactions = [],
  payouts = [],
  budgets = [],
  accounts = [],
}: CashflowPanelProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [exportMonth, setExportMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM format
  );
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [payoutStatusUpdating, setPayoutStatusUpdating] = useState<string | null>(null);

  // Handle preview calculation
  const handleCalculatePreview = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const response = await fetch('/api/treasury/payouts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount === 'ALL' ? 'ALL' : selectedAccount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setPreviewError(errorData.error || 'Failed to load preview');
        return;
      }

      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Error loading preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle create payout
  const handleCreatePayout = async (accountId: string) => {
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const response = await fetch('/api/treasury/payouts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setCreateError(errorData.error || 'Failed to create payout');
        return;
      }

      const data = await response.json();
      setCreateSuccess(`Payout v${data.version} created for cycle ${data.cycleStart}`);
      // Refresh preview
      await handleCalculatePreview();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Error creating payout');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle payout status update
  const handleUpdatePayoutStatus = async (payoutId: string, newStatus: string) => {
    setPayoutStatusUpdating(payoutId);

    try {
      const response = await fetch('/api/treasury/payouts/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId, status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setCreateError(errorData.error || 'Failed to update status');
        return;
      }

      // Refresh payouts
      window.location.reload();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Error updating status');
    } finally {
      setPayoutStatusUpdating(null);
    }
  };

  // Handle export CSV
  const handleExportCsv = async () => {
    if (!exportMonth) {
      setExportError('Please select a month');
      return;
    }

    setExportLoading(true);
    setExportError(null);

    try {
      const response = await fetch(`/api/treasury/export?month=${exportMonth}`);

      if (!response.ok) {
        const errorText = await response.text();
        setExportError(errorText || 'Failed to export CSV');
        return;
      }

      // Get CSV content and download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `treasury-export-${exportMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Error exporting CSV');
    } finally {
      setExportLoading(false);
    }
  };

  // Group transactions by type
  const transactionsByType = {
    income: transactions.filter((t) => t.type === 'income'),
    expense: transactions.filter((t) => t.type === 'expense'),
    transfer: transactions.filter((t) => t.type === 'transfer'),
    adjustment: transactions.filter((t) => t.type === 'adjustment'),
  };

  // Calculate totals
  const totalIncome = transactionsByType.income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactionsByType.expense.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalTransfer = transactionsByType.transfer.reduce((sum, t) => sum + t.amount, 0);
  const totalPayouts = payouts.reduce((sum, p) => sum + p.amount, 0);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-green-600';
      case 'expense':
        return 'bg-red-600';
      case 'transfer':
        return 'bg-blue-600';
      case 'adjustment':
        return 'bg-yellow-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getPayoutStatusColor = (status: string) => {
    switch (status) {
      case 'received':
        return 'bg-green-600';
      case 'sent':
        return 'bg-blue-600';
      case 'planned':
        return 'bg-yellow-600';
      case 'canceled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-white font-medium mb-2">Cashflow Overview</h3>
        <p className="text-sm text-slate-400">
          View transactions, payouts, budgets, and payout engine
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-green-900/20 border-green-500/30">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-1">Total Income</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-slate-500 mt-1">{transactionsByType.income.length} txs</p>
          </CardContent>
        </Card>

        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-1">Total Expenses</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(totalExpense)}</p>
            <p className="text-xs text-slate-500 mt-1">{transactionsByType.expense.length} txs</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-900/20 border-blue-500/30">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-1">Transfers</p>
            <p className="text-lg font-bold text-blue-400">{formatCurrency(totalTransfer)}</p>
            <p className="text-xs text-slate-500 mt-1">{transactionsByType.transfer.length} txs</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-900/20 border-purple-500/30">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-1">Payouts</p>
            <p className="text-lg font-bold text-purple-400">{formatCurrency(totalPayouts)}</p>
            <p className="text-xs text-slate-500 mt-1">{payouts.length} scheduled</p>
          </CardContent>
        </Card>
      </div>

      {/* EXPORT SECTION */}
      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-white font-medium mb-4">Export</h3>

        <Card className="bg-slate-900 border-slate-800 mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-2">Month to Export</label>
                <input
                  type="month"
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                />
              </div>
              <button
                onClick={handleExportCsv}
                disabled={exportLoading}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
              >
                {exportLoading ? '⏳ Exporting...' : '📥 Export CSV'}
              </button>
            </div>

            {exportError && (
              <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
                ❌ {exportError}
              </div>
            )}

            <p className="text-xs text-slate-500 mt-3">
              Exports monthly summary with payouts and transactions in CSV format
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PAYOUT ENGINE SECTION */}
      <div className="border-t border-slate-700 pt-6">
        <h3 className="text-white font-medium mb-4">Payout Engine</h3>

        {/* Account Selector + Calculate Button */}
        <Card className="bg-slate-900 border-slate-800 mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-2">Account</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="ALL">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCalculatePreview}
                  disabled={previewLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white px-4 py-2 rounded text-sm font-medium"
                >
                  {previewLoading ? '⏳ Loading...' : '📊 Calculate'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error/Success Messages */}
        {previewError && (
          <Card className="bg-red-900/20 border-red-500/30 mb-4">
            <CardContent className="pt-4">
              <p className="text-red-400 text-sm">❌ {previewError}</p>
            </CardContent>
          </Card>
        )}
        {createError && (
          <Card className="bg-red-900/20 border-red-500/30 mb-4">
            <CardContent className="pt-4">
              <p className="text-red-400 text-sm">❌ {createError}</p>
            </CardContent>
          </Card>
        )}
        {createSuccess && (
          <Card className="bg-green-900/20 border-green-500/30 mb-4">
            <CardContent className="pt-4">
              <p className="text-green-400 text-sm">✅ {createSuccess}</p>
            </CardContent>
          </Card>
        )}

        {/* Preview Table */}
        {previewData && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              Cycle: <span className="text-white font-medium">{String(previewData.cycleDatesFormatted || '')}</span>
            </div>

            {/* Per-Account Preview */}
            <div className="space-y-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(previewData.perAccountPreview || []).map((account: any) => (
                <Card key={account.accountId as string} className="bg-slate-800 border-slate-700">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {/* Account Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{account.accountName}</p>
                          <p className="text-xs text-slate-400">
                            Balance: {formatCurrency(account.currentBalance)} | Size: {formatCurrency(account.accountSize)}
                          </p>
                        </div>
                        <div className="text-right">
                          {account.isCreatable ? (
                            <Badge className="bg-green-600">Ready</Badge>
                          ) : account.blockedReasons.length > 0 ? (
                            <Badge className="bg-red-600">Blocked</Badge>
                          ) : (
                            <Badge className="bg-yellow-600">N/A</Badge>
                          )}
                        </div>
                      </div>

                      {/* Period PnL + Drawdown */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-700/50 rounded p-2">
                          <p className="text-slate-400">Period PnL</p>
                          <p className={`font-bold ${account.periodPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(account.periodPnL)}
                          </p>
                        </div>
                        <div className="bg-slate-700/50 rounded p-2">
                          <p className="text-slate-400">Drawdown</p>
                          <p className={`font-bold ${account.currentDrawdown < 20 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {account.currentDrawdown.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      {/* Breakdown Table */}
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-slate-700">
                          <tr className="divide-x divide-slate-700">
                            <td className="px-2 py-1 text-slate-400">Retirable</td>
                            <td className="px-2 py-1 text-white font-bold text-right">
                              {formatCurrency(account.retirable)}
                            </td>
                          </tr>
                          <tr className="divide-x divide-slate-700">
                            <td className="px-2 py-1 text-slate-400">Tax Reserve</td>
                            <td className="px-2 py-1 text-white font-bold text-right">
                              {formatCurrency(account.taxReserveAmount)}
                            </td>
                          </tr>
                          <tr className="divide-x divide-slate-700">
                            <td className="px-2 py-1 text-slate-400">Bonus Vault</td>
                            <td className="px-2 py-1 text-white font-bold text-right">
                              {formatCurrency(account.bonusVaultAmount)}
                            </td>
                          </tr>
                          <tr className="divide-x divide-slate-700 bg-blue-900/20">
                            <td className="px-2 py-1 text-blue-400 font-bold">Cash Payout</td>
                            <td className="px-2 py-1 text-blue-400 font-bold text-right">
                              {formatCurrency(account.cashPayoutAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Blocked Reasons */}
                      {account.blockedReasons.length > 0 && (
                        <div className="bg-red-900/20 rounded p-2 text-xs">
                          <p className="text-red-400 font-medium mb-1">Blocked reasons:</p>
                          <ul className="text-red-400 space-y-1">
                            {account.blockedReasons.map((reason: string) => (
                              <li key={reason}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!account.walletMapped && (
                        <div className="bg-yellow-900/20 rounded p-2 text-xs">
                          <p className="text-yellow-400">⚠️ Wallet not mapped (set wallet_id in config)</p>
                        </div>
                      )}

                      {/* Create Payout Button */}
                      <button
                        onClick={() => handleCreatePayout(account.accountId)}
                        disabled={!account.isCreatable || createLoading}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white px-3 py-2 rounded text-sm font-medium"
                      >
                        {createLoading ? '⏳ Creating...' : '✅ Create Payout'}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Totals */}
            {previewData.totals && (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-4">
                  <p className="text-white font-medium mb-3">Total (All Accounts)</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-700/50 rounded p-2">
                      <p className="text-slate-400">Total Retirable</p>
                      <p className="font-bold text-white">{formatCurrency(previewData.totals.retirable)}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded p-2">
                      <p className="text-slate-400">Total Tax Reserve</p>
                      <p className="font-bold text-white">{formatCurrency(previewData.totals.taxReserve)}</p>
                    </div>
                    <div className="bg-slate-700/50 rounded p-2">
                      <p className="text-slate-400">Total Bonus Vault</p>
                      <p className="font-bold text-white">{formatCurrency(previewData.totals.bonusVault)}</p>
                    </div>
                    <div className="bg-blue-900/20 rounded p-2">
                      <p className="text-blue-400">Total Cash Payout</p>
                      <p className="font-bold text-blue-400">{formatCurrency(previewData.totals.cashPayout)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Threshold Notifications */}
            {previewData.pushNotificationsPending && previewData.pushNotificationsPending.length > 0 && (
              <Card className="bg-blue-900/20 border-blue-500/30">
                <CardContent className="pt-4">
                  <p className="text-blue-400 text-sm font-medium mb-2">📢 Pending Threshold Notifications:</p>
                  <ul className="text-blue-400 text-xs space-y-1">
                    {previewData.pushNotificationsPending.map((notif: Record<string, unknown>) => (
                      <li key={notif.accountId as string}>• {notif.accountName as string}: {notif.message as string}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        <h4 className="text-white font-medium text-sm">Recent Transactions</h4>
        {transactions.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6 text-center">
              <p className="text-slate-400 text-sm">No transactions yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactions.slice(0, 10).map((tx) => (
              <Card key={tx.id} className="bg-slate-900 border-slate-800">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getTypeColor(tx.type)}>
                          {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                        </Badge>
                        <span className="text-sm text-slate-300">{tx.description || '—'}</span>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(tx.occurred_on)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Payouts List */}
      <div className="space-y-3">
        <h4 className="text-white font-medium text-sm">Scheduled Payouts</h4>
        {payouts.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6 text-center">
              <p className="text-slate-400 text-sm">No payouts scheduled</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {payouts.slice(0, 10).map((payout) => (
              <Card key={payout.id} className="bg-slate-900 border-slate-800">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getPayoutStatusColor(payout.status)}>
                          {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                        </Badge>
                        <span className="text-sm text-slate-300">{payout.method || 'Bank'}</span>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(payout.payout_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCurrency(payout.amount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Budgets */}
      <div className="space-y-3">
        <h4 className="text-white font-medium text-sm">Period Budgets</h4>
        {budgets.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6 text-center">
              <p className="text-slate-400 text-sm">No budgets set</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {budgets.slice(0, 5).map((budget) => (
              <Card key={budget.id} className="bg-slate-900 border-slate-800">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-white font-medium">
                      {formatDate(budget.period_start)} → {formatDate(budget.period_end)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {budget.target_income && (
                      <div className="text-green-400">
                        Income: {formatCurrency(budget.target_income)}
                      </div>
                    )}
                    {budget.target_expense && (
                      <div className="text-red-400">
                        Expense: {formatCurrency(budget.target_expense)}
                      </div>
                    )}
                    {budget.target_payout && (
                      <div className="text-blue-400">
                        Payout: {formatCurrency(budget.target_payout)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ Cashflow shows income, expenses, transfers, and payouts. Set period budgets
          to track targets and compare actuals.
        </p>
      </div>
    </div>
  );
}
