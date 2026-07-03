'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plug, Unplug, Zap, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import CmePositionsPanel from './CmePositionsPanel.client';
import CmeEquityCurve from './CmeEquityCurve.client';
import CmeRiskConfigPanel from './CmeRiskConfigPanel.client';
import CmeTradesTable from './CmeTradesTable.client';
import CmeShadowSignalsPanel from './CmeShadowSignalsPanel.client';
import CmePropfirmRulesPanel from './CmePropfirmRulesPanel.client';

interface AlgoCmeAccount {
  id: string;
  label: string;
  provider_name: string;
  account_number: string;
  account_type: string;
  is_paper: boolean;
  funded_amount: number | null;
  max_daily_loss: number | null;
}

interface Connection {
  id: string;
  status: string;
  tradovate_account_spec: string | null;
  daily_pnl_usd: number | null;
  last_error: string | null;
  last_connected_at: string | null;
  cme_account_id: string;
  algo_cme_accounts: AlgoCmeAccount;
}

interface ConnectForm {
  accountId: string;
  username: string;
  password: string;
  // OAuth credentials (opcionales — Tradovate los exige para producción).
  // Demo cuentas funcionan sin ellos.
  cid: string;
  sec: string;
  appId: string;
  appVersion: string;
}

export default function CmePropFirmWorkspace() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [propfirmAccounts, setPropfirmAccounts] = useState<AlgoCmeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [killSwitching, setKillSwitching] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectForm>({
    accountId: '',
    username: '',
    password: '',
    cid: '',
    sec: '',
    appId: 'AlphaLog',
    appVersion: '1.0.0',
  });
  const [showOauth, setShowOauth] = useState(false);

  const fetchData = useCallback(async () => {
    const [connRes, acctRes] = await Promise.all([
      fetch('/api/cme/connections'),
      fetch('/api/intelligence/algorithms/cme-accounts?type=propfirm'),
    ]);

    if (connRes.ok) {
      const { data } = await connRes.json();
      setConnections((data ?? []).filter((c: Connection) =>
        c.algo_cme_accounts?.account_type === 'propfirm' ||
        !c.algo_cme_accounts
      ));
    }

    if (acctRes.ok) {
      const { data } = await acctRes.json();
      setPropfirmAccounts(data ?? []);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const connectedIds = new Set(connections.filter(c => c.status === 'connected').map(c => c.cme_account_id));
  const unconnectedAccounts = propfirmAccounts.filter(a => !connectedIds.has(a.id));

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId || !form.username || !form.password) {
      toast.error('Fill in all fields');
      return;
    }
    setConnecting(true);
    try {
      const cidNum = form.cid ? Number(form.cid) : 0;
      const res = await fetch('/api/cme/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmeAccountId: form.accountId,
          tradovateUsername: form.username,
          tradovatePassword: form.password,
          appId: form.appId || 'AlphaLog',
          appVersion: form.appVersion || '1.0.0',
          cid: Number.isFinite(cidNum) ? cidNum : 0,
          sec: form.sec,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Connection failed');
        return;
      }
      toast.success('Connected to Tradovate');
      setForm({
        accountId: '',
        username: '',
        password: '',
        cid: '',
        sec: '',
        appId: 'AlphaLog',
        appVersion: '1.0.0',
      });
      fetchData();
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(cmeAccountId: string) {
    setDisconnecting(cmeAccountId);
    try {
      const res = await fetch(`/api/cme/connect/${cmeAccountId}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Disconnect failed'); return; }
      toast.success('Disconnected');
      fetchData();
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleKillSwitch(cmeAccountId: string, label: string) {
    if (!confirm(`Close ALL positions on ${label} and pause trading?`)) return;
    setKillSwitching(cmeAccountId);
    try {
      const res = await fetch('/api/cme/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmeAccountId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Kill switch failed'); return; }
      toast.success(`${data.closedCount} position(s) closed. Trading paused.`);
      fetchData();
    } finally {
      setKillSwitching(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {connections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Connected Accounts</h3>

          {connections.map(conn => {
            const acct = conn.algo_cme_accounts;
            const pnl = Number(conn.daily_pnl_usd ?? 0);
            const isExpanded = expandedId === conn.cme_account_id;

            return (
              <div key={conn.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    conn.status === 'connected' ? 'bg-emerald-400' :
                    conn.status === 'error' ? 'bg-rose-400' :
                    conn.status === 'paused' ? 'bg-amber-400' : 'bg-white/20'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{acct?.label ?? conn.cme_account_id}</span>
                      {acct?.is_paper && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Demo</span>
                      )}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {acct?.provider_name} · {conn.tradovate_account_spec ?? acct?.account_number}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </div>
                    <div className="text-xs text-white/30">Daily P&L</div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleKillSwitch(conn.cme_account_id, acct?.label ?? 'account')}
                      disabled={killSwitching === conn.cme_account_id}
                      className="p-1.5 rounded text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-40"
                      title="Kill switch: close all positions"
                      aria-label="Kill switch"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDisconnect(conn.cme_account_id)}
                      disabled={disconnecting === conn.cme_account_id}
                      className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40"
                      title="Disconnect"
                      aria-label="Disconnect"
                    >
                      <Unplug className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : conn.cme_account_id)}
                      className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {conn.status === 'error' && conn.last_error && (
                  <div className="px-4 py-2 border-t border-rose-500/20 bg-rose-500/5 text-xs text-rose-400">
                    {conn.last_error}
                  </div>
                )}

                {isExpanded && (
                  <div className="border-t border-white/10 p-4 space-y-6">
                    <div>
                      <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3" /> Equity Curve
                      </h4>
                      <CmeEquityCurve cmeAccountId={conn.cme_account_id} />
                    </div>

                    <div>
                      <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Open Positions</h4>
                      <CmePositionsPanel cmeAccountId={conn.cme_account_id} />
                    </div>

                    <div>
                      <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Risk Config</h4>
                      <CmeRiskConfigPanel cmeAccountId={conn.cme_account_id} />
                    </div>

                    <div>
                      <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">PropFirm Rules</h4>
                      <CmePropfirmRulesPanel cmeAccountId={conn.cme_account_id} />
                    </div>

                    <div>
                      <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Signals (shadow + rejected)</h4>
                      <CmeShadowSignalsPanel cmeAccountId={conn.cme_account_id} />
                    </div>

                    <div>
                      <h4 className="text-xs text-white/40 uppercase tracking-wider mb-2">Trade History</h4>
                      <CmeTradesTable cmeAccountId={conn.cme_account_id} tableType="propfirm" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {unconnectedAccounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Connect Account</h3>
          <form onSubmit={handleConnect} className="space-y-3 p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="space-y-1">
              <label className="text-xs text-white/50">PropFirm Account</label>
              <select
                value={form.accountId}
                onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
              >
                <option value="">Select account…</option>
                {unconnectedAccounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.provider_name} {a.is_paper ? '(Demo)' : '(Live)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-white/50">Tradovate Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoComplete="username"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/50">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <p className="text-xs text-white/30">Password is used only for authentication and never stored.</p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowOauth(s => !s)}
                className="text-xs text-white/40 hover:text-white/70 inline-flex items-center gap-1"
              >
                {showOauth ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                OAuth credentials (required for production Tradovate)
              </button>

              {showOauth && (
                <div className="space-y-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-white/50">cid</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.cid}
                        onChange={e => setForm(f => ({ ...f, cid: e.target.value }))}
                        placeholder="0 (demo)"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/50">sec</label>
                      <input
                        type="text"
                        value={form.sec}
                        onChange={e => setForm(f => ({ ...f, sec: e.target.value }))}
                        placeholder="(demo: dejar vacio)"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30 placeholder:text-white/20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-white/50">appId</label>
                      <input
                        type="text"
                        value={form.appId}
                        onChange={e => setForm(f => ({ ...f, appId: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/50">appVersion</label>
                      <input
                        type="text"
                        value={form.appVersion}
                        onChange={e => setForm(f => ({ ...f, appVersion: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-white/30">
                    Get cid/sec at <span className="text-white/50">https://api.tradovate.com/register</span> for live trading.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/20 text-amber-400 font-medium text-sm hover:bg-amber-500/30 transition-colors disabled:opacity-40"
            >
              <Plug className="w-4 h-4" />
              {connecting ? 'Connecting…' : 'Connect to Tradovate'}
            </button>
          </form>
        </div>
      )}

      {connections.length === 0 && unconnectedAccounts.length === 0 && (
        <div className="text-center py-8 text-white/30 text-sm">
          No PropFirm accounts configured. Add one in the New Strategy wizard.
        </div>
      )}
    </div>
  );
}
