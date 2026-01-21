import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Account, TreasuryConfig, Trade } from '@/lib/treasury/calculations';
import { calculateDrawdown, formatPercentage } from '@/lib/treasury/calculations';

interface AntiDDPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  trades: Trade[];
}

export default function AntiDDPanel({
  accounts,
  configs,
  trades,
}: AntiDDPanelProps) {
  const configMap = new Map(configs.map((c) => [c.account_id, c]));

  return (
    <div className="space-y-6">
      <h3 className="text-white font-medium">Anti-Drawdown Protection</h3>

      {/* Account Anti-DD Settings */}
      {accounts.map((account) => {
        const config = configMap.get(account.id);
        const antiDDEnabled = config?.anti_drawdown_active || false;
        const antiDDThreshold = config?.anti_drawdown_threshold || 20;
        const drawdown = calculateDrawdown(account.id, account, trades);
        const isBlocked = antiDDEnabled && drawdown >= antiDDThreshold;

        return (
          <Card
            key={account.id}
            className={`border-2 ${
              isBlocked
                ? 'bg-red-900/20 border-red-500/30'
                : antiDDEnabled
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-slate-900 border-slate-800'
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{account.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Anti-DD Status */}
              <div className="flex items-center justify-between">
                <p className="text-slate-400">Anti-DD Protection</p>
                <Badge className={antiDDEnabled ? 'bg-green-600' : 'bg-gray-600'}>
                  {antiDDEnabled ? '✓ Enabled' : '✗ Disabled'}
                </Badge>
              </div>

              {/* Threshold */}
              {antiDDEnabled && (
                <>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">DD Threshold</p>
                    <p className="text-lg text-slate-300">{formatPercentage(antiDDThreshold)}</p>
                  </div>

                  {/* Current Drawdown */}
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Current Drawdown</p>
                    <p className={`text-lg font-bold ${drawdown >= antiDDThreshold ? 'text-red-400' : 'text-green-400'}`}>
                      {formatPercentage(drawdown)}
                    </p>
                  </div>

                  {/* Status */}
                  {isBlocked && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                      <p className="text-red-400 text-sm">
                        ⚠️ Drawdown exceeds threshold - Withdrawals BLOCKED
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ Anti-Drawdown (Anti-DD) protection pauses withdrawals when account
          drawdown exceeds a specified threshold, protecting capital from large losses.
        </p>
      </div>
    </div>
  );
}
