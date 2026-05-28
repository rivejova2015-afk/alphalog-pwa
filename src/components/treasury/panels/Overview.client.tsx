"use client";

import { useSelfHealingCache } from '@/lib/reconciler/selfHealingCache';
import { useIntegrityWatchdog } from '@/lib/reconciler/integrityWatchdog';
import { useState } from 'react';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Account, TreasuryConfig } from '@/lib/treasury/calculations';
import type { TreasuryWallet } from '@/lib/treasury/queries';
import {
  calculateRetirable,
  daysUntilNextWithdrawal,
  formatCurrency,
} from '@/lib/treasury/calculations';

interface OverviewPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  wallets?: TreasuryWallet[];
}

export default function OverviewPanel({
  accounts,
  configs,
  wallets = [],
}: OverviewPanelProps) {
  // Self-Healing Cache: detect mismatch between UI and DB (accounts)
  useSelfHealingCache(
    async () => {
      return accounts.some(acc => acc.current_balance < 0);
    },
    () => {
      // Aquí podrías disparar un refetch o reset de cuentas
    }
  );

  // Integrity Watchdog: detecta inconsistencias y repara índice
  useIntegrityWatchdog(
    async () => {
      return accounts.every(acc => !!acc.name);
    },
    async () => {
      // Aquí podrías disparar una reconstrucción o refetch
    }
  );

  // Wallet creator local state (shown when wallets.length === 0)
  const [localWallets, setLocalWallets] = useState<TreasuryWallet[]>(wallets);
  const [walletName, setWalletName] = useState('Main USD');
  const [walletCurrency, setWalletCurrency] = useState('USD');
  const [walletStarting, setWalletStarting] = useState('0');
  const [creating, setCreating] = useState(false);

  const handleCreateWallet = async () => {
    if (!walletName.trim()) {
      toast.error('Wallet name is required');
      return;
    }
    const starting = Number(walletStarting);
    if (!Number.isFinite(starting) || starting < 0) {
      toast.error('Starting balance must be ≥ 0');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/treasury/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: walletName.trim(),
          currency: walletCurrency.trim().toUpperCase() || 'USD',
          starting_balance: starting,
        }),
      });
      if (!res.ok) {
        toast.error('No se pudo crear el wallet');
        return;
      }
      const { wallet } = (await res.json()) as { wallet: TreasuryWallet };
      setLocalWallets((prev) => [...prev, wallet]);
      toast.success(`Wallet "${wallet.name}" creado`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setCreating(false);
    }
  };

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

  const showWalletBanner = localWallets.length === 0;
  const configsWithoutWallet = configs.filter((c) => !c.wallet_id);

  return (
    <div className="space-y-6">
      {/* Wallet onboarding banner — Sprint 2 activation */}
      {showWalletBanner && (
        <Card className="bg-amber-900/20 border-amber-500/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-200 flex items-center gap-2">
              <Wallet className="w-5 h-5" /> Crea tu primer wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-100/80">
              Sin un wallet no podés crear payouts. Definí dónde se acumulan los retiros (cash USD,
              cuenta bancaria, exchange, etc.). Sólo es un nombre y una moneda — la lógica de balances
              vive en `treasury_transactions`.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="wallet-name" className="block text-xs text-amber-200/80 mb-1">Nombre</label>
                <input
                  id="wallet-name"
                  type="text"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  disabled={creating}
                  className="w-full px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded text-sm text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="wallet-currency" className="block text-xs text-amber-200/80 mb-1">Moneda</label>
                <input
                  id="wallet-currency"
                  type="text"
                  value={walletCurrency}
                  onChange={(e) => setWalletCurrency(e.target.value)}
                  maxLength={10}
                  disabled={creating}
                  className="w-full px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded text-sm text-white uppercase disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="wallet-start" className="block text-xs text-amber-200/80 mb-1">Starting balance</label>
                <input
                  id="wallet-start"
                  type="number"
                  step="any"
                  min={0}
                  value={walletStarting}
                  onChange={(e) => setWalletStarting(e.target.value)}
                  disabled={creating}
                  className="w-full px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded text-sm text-white disabled:opacity-50"
                />
              </div>
            </div>
            <button
              onClick={() => void handleCreateWallet()}
              disabled={creating}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-medium rounded text-sm disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear wallet'}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Config-wallet linking nudge — if user has wallets but some configs unlinked */}
      {!showWalletBanner && configsWithoutWallet.length > 0 && (
        <Card className="bg-blue-900/20 border-blue-500/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-blue-200">
              ℹ️ {configsWithoutWallet.length} cuenta(s) sin wallet asignado. Asigná uno en la pestaña
              configs (o vía `PUT /api/treasury/configs` con `wallet_id`) para habilitar payouts.
            </p>
          </CardContent>
        </Card>
      )}

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
