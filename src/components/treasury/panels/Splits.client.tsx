import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Account, TreasuryConfig } from '@/lib/treasury/calculations';
import {
  calculateRetirable,
  getSplitPercentage,
  formatCurrency,
} from '@/lib/treasury/calculations';

interface SplitsPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
}

const splitModes = [
  { value: 'growth', label: '📈 Growth', percentage: 50, description: 'Aggressive growth' },
  { value: 'safe', label: '⚖️ Safe', percentage: 40, description: 'Balanced approach' },
  { value: 'cash', label: '💰 Cash', percentage: 100, description: 'All profits retirable' },
];

export default function SplitsPanel({
  accounts,
  configs,
}: SplitsPanelProps) {
  const configMap = new Map(configs.map((c) => [c.account_id, c]));

  return (
    <div className="space-y-6">
      {/* Split Mode Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {splitModes.map((mode) => (
          <Card key={mode.value} className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">{mode.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">{mode.percentage}%</p>
              <p className="text-xs text-slate-400 mt-2">{mode.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Account Split Selection */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Account Split Modes</h3>
        {accounts.map((account) => {
          const config = configMap.get(account.id);
          const splitMode = config?.split_mode || 'safe';
          const splitPercentage = getSplitPercentage(splitMode);
          const retirable = calculateRetirable(account, config);

          return (
            <Card key={account.id} className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium mb-2">{account.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">
                        {splitModes.find((m) => m.value === splitMode)?.label}
                      </Badge>
                      <span className="text-sm text-slate-400">
                        {splitPercentage}% of profits retirable
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(retirable)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Retirable</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ Split mode determines what % of profit can be withdrawn as retirable.
          Remaining profit stays in account for risk management.
        </p>
      </div>
    </div>
  );
}
