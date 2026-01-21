import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Account, TreasuryConfig } from '@/lib/treasury/calculations';
import { formatCurrency } from '@/lib/treasury/calculations';

interface UmbralPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
}

export default function UmbralPanel({
  accounts,
  configs,
}: UmbralPanelProps) {
  const configMap = new Map(configs.map((c) => [c.account_id, c]));

  return (
    <div className="space-y-6">
      <h3 className="text-white font-medium">Balance Threshold (Umbral)</h3>
      
      {/* Account Thresholds */}
      {accounts.map((account) => {
        const config = configMap.get(account.id);
        const threshold = config?.balance_threshold || 0;
        const currentBalance = account.current_balance || 0;
        const isEligible = currentBalance >= threshold;
        const isEvalPhase = account.phase_status?.includes('fase');

        return (
          <Card
            key={account.id}
            className={`border-2 ${
              isEvalPhase
                ? 'bg-red-900/20 border-red-500/30'
                : isEligible
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-yellow-900/20 border-yellow-500/30'
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{account.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Balance */}
              <div>
                <p className="text-sm text-slate-400 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(currentBalance)}
                </p>
              </div>

              {/* Threshold */}
              <div>
                <p className="text-sm text-slate-400 mb-1">Withdrawal Threshold</p>
                <p className="text-lg text-slate-300">{formatCurrency(threshold)}</p>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                {isEvalPhase ? (
                  <Badge className="bg-red-600">⚠️ Evaluation Phase</Badge>
                ) : isEligible ? (
                  <Badge className="bg-green-600">✓ Eligible for Withdrawal</Badge>
                ) : (
                  <Badge className="bg-yellow-600">
                    ⏳ Need {formatCurrency(threshold - currentBalance)} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ The balance threshold (Umbral) is the minimum account balance required
          before withdrawals can be made. Set to protect account growth.
        </p>
      </div>
    </div>
  );
}
