import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Account, TreasuryConfig } from '@/lib/treasury/calculations';
import {
  calculateMilestoneProgress,
  calculateMilestoneRemaining,
  calculateTaxBufferProgress,
  formatCurrency,
  formatPercentage,
} from '@/lib/treasury/calculations';

interface MilestonePanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
}

export default function MilestonePanel({
  accounts,
  configs,
}: MilestonePanelProps) {
  const configMap = new Map(configs.map((c) => [c.account_id, c]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-white font-medium mb-2">Milestone & Bonus Tracking</h3>
        <p className="text-sm text-slate-400">
          Track progress toward target balances, tax reserves, and bonus milestones
        </p>
      </div>

      {/* Account Milestones */}
      <div className="space-y-4">
        {accounts.map((account) => {
          const config = configMap.get(account.id);
          const hasMilestone = config?.milestone_target && config.milestone_target > 0;
          const progress = calculateMilestoneProgress(account, config);
          const remaining = calculateMilestoneRemaining(account, config);
          const taxProgress = calculateTaxBufferProgress(config);
          const bonusVault = config?.milestone_bonus_vault || 0;

          return (
            <div key={account.id} className="space-y-3">
              {/* Account Header */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base">{account.name}</CardTitle>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Current Balance</p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(account.current_balance)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Milestone Progress */}
              {hasMilestone ? (
                <Card className="bg-blue-900/20 border-blue-500/30">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium">🎯 Milestone Target</p>
                        <p className="text-lg text-blue-400">
                          {formatCurrency(config?.milestone_target || 0)}
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full transition-all"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-blue-400">{formatPercentage(progress)}</span>
                      </div>

                      {remaining > 0 && (
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-blue-500/20">
                          <span className="text-slate-400">Remaining</span>
                          <span className="text-amber-400">{formatCurrency(remaining)}</span>
                        </div>
                      )}

                      {remaining === 0 && (
                        <div className="flex items-center justify-between text-sm pt-2 border-t border-green-500/20 bg-green-500/10 -mx-6 px-6 py-2">
                          <span className="text-slate-300">🎉 Milestone Reached!</span>
                          <Badge className="bg-green-600">Complete</Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-slate-900 border-slate-800 opacity-50">
                  <CardContent className="pt-6">
                    <p className="text-slate-400 text-sm text-center">
                      No milestone target set for this account
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Tax Buffer & Bonus Vault */}
              <div className="grid grid-cols-2 gap-3">
                {/* Tax Buffer */}
                <Card className="bg-green-900/20 border-green-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-slate-400 mb-2">Tax Buffer</p>
                    <p className="text-lg font-bold text-green-400">
                      {formatCurrency(config?.tax_buffer_accumulated || 0)}
                    </p>
                    {config?.tax_buffer_target && (
                      <>
                        <div className="w-full bg-slate-700 rounded-full h-1 mt-2 overflow-hidden">
                          <div
                            className="bg-green-500 h-full transition-all"
                            style={{ width: `${Math.min(100, taxProgress)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatPercentage(taxProgress)} of target
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Bonus Vault */}
                <Card className="bg-purple-900/20 border-purple-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-slate-400 mb-2">Bonus Vault</p>
                    <p className="text-lg font-bold text-purple-400">
                      {formatCurrency(bonusVault)}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">Accumulated</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ Milestones track progress toward a target balance. Tax Buffer reserves
          quarterly/annual taxes. Bonus Vault accumulates milestone rewards.
        </p>
      </div>
    </div>
  );
}
