import { useSelfHealingCache } from '@/lib/reconciler/selfHealingCache';
import { useIntegrityWatchdog } from '@/lib/reconciler/integrityWatchdog';
  // Self-Healing Cache: detect mismatch between UI and DB (accounts)
  useSelfHealingCache(
    async () => {
      // Simulación: mismatch si alguna cuenta tiene balance negativo (puedes reemplazar por lógica real)
      return accounts.some(acc => acc.current_balance < 0);
    },
    () => {
      // Invalida caché: aquí podrías disparar un refetch o reset de cuentas
      // Por ahora solo log
      // window.location.reload(); // O usar SWR mutate, etc.
    }
  );

  // Integrity Watchdog: detecta inconsistencias y repara índice
  useIntegrityWatchdog(
    async () => {
      // Simulación: integridad ok si todas las cuentas tienen nombre
      return accounts.every(acc => !!acc.name);
    },
    async () => {
      // Reparar índice: aquí podrías disparar una reconstrucción o refetch
      // Por ahora solo log
    }
  );
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Account, TreasuryConfig } from '@/lib/treasury/calculations';
import {
  calculateRetirable,
  daysUntilNextWithdrawal,
  formatCurrency,
} from '@/lib/treasury/calculations';

interface OverviewPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
}

export default function OverviewPanel({
  accounts,
  configs,
}: OverviewPanelProps) {
  // Get config lookup
  const configMap = new Map(configs.map((c) => [c.account_id, c]));

  // Calculate totals (all accounts)
  const totalRetirable = accounts.reduce((sum, acc) => {
    const config = configMap.get(acc.id);
    return sum + calculateRetirable(acc, config);
  }, 0);

  const totalTaxBuffer = configs.reduce((sum, c) => sum + (c.tax_buffer_accumulated || 0), 0);
  const totalBonusVault = configs.reduce((sum, c) => sum + (c.milestone_bonus_vault || 0), 0);

  // Days until next withdrawal
  const daysUntilWithdrawal = daysUntilNextWithdrawal(
    configs[0]?.withdrawal_day || 1
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400">
              💰 Retirable Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalRetirable)}</p>
            <p className="text-xs text-slate-400 mt-1">All accounts</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400">
              🛡️ Tax Buffer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalTaxBuffer)}</p>
            <p className="text-xs text-slate-400 mt-1">Accumulated</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400">
              🎁 Bonus Vault
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalBonusVault)}</p>
            <p className="text-xs text-slate-400 mt-1">Accumulated</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-400">
              📅 Next Withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{daysUntilWithdrawal}</p>
            <p className="text-xs text-slate-400 mt-1">days</p>
          </CardContent>
        </Card>
      </div>

      {/* Account List */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Accounts</h3>
        {accounts.map((account) => {
          const config = configMap.get(account.id);
          const retirable = calculateRetirable(account, config);
          const isEvaluationPhase = account.phase_status?.includes('fase');

          return (
            <Card
              key={account.id}
              className={`border-2 ${
                isEvaluationPhase
                  ? 'bg-red-900/20 border-red-500/30'
                  : account.withdrawals_enabled
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-slate-900 border-slate-800'
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium">{account.name}</p>
                      {account.phase_status && (
                        <Badge variant="outline" className="text-xs">
                          {account.phase_status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">
                      Balance: {formatCurrency(account.current_balance)}
                    </p>
                    {isEvaluationPhase ? (
                      <Badge className="mt-2 bg-red-600">⚠️ Evaluation Phase</Badge>
                    ) : (
                      <Badge
                        className={`mt-2 ${
                          account.withdrawals_enabled ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      >
                        {account.withdrawals_enabled ? '✓ Withdrawals ON' : '✗ No Withdrawals'}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-white">
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
    </div>
  );
}
