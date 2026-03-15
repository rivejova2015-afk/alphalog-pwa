'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

// ═══ TYPES ═══
interface BotInstance { status: string; last_heartbeat_at: string | null; instance_id: string | null; }
interface BotEvent { event_type: string; payload: Record<string, unknown>; created_at: string; }
interface BotCommand { command_type: string; status: string; created_at: string; }
interface TelemetryRow { balance: number | null; equity: number | null; positions_total: number | null; positions_buy: number | null; positions_sell: number | null; basket_r: number | null; tier: string | null; last_signal_text: string | null; last_heartbeat_ts: string | null; }
interface AppLog { level: string; area: string; message: string; created_at: string; }
interface SupaData {
  snapshot: { total_tables: number; rls_enabled: number; total_rows: number; db_size: string };
  trading: Record<string, number>;
  business: Record<string, number>;
  bot: Record<string, number>;
  intelligence: Record<string, number>;
  security: Record<string, number>;
  terminal: Record<string, number>;
  bot_events: BotEvent[];
  app_logs: AppLog[];
  bot_commands: BotCommand[];
  bot_instances: BotInstance[];
  telemetry: TelemetryRow[];
}
interface VercelData {
  name: string; framework: string; nodeVersion: string;
  latestDeployment: { id: string; readyState: string; createdAt: number };
  domains: string[];
  deploys: { msg: string; state: string; ts: number }[];
}

// ═══ AGENTS ═══
const AGENTS = [
  { id: 'market-sentinel',   name: 'Market Sentinel',   model: 'Opus',   letter: 'MS', module: 'terminal',    desc: 'Analiza noticias de mercado y sentimiento',        pct: 90 },
  { id: 'bug-fixer',         name: 'Bug Fixer',         model: 'Sonnet', letter: 'BF', module: 'security',    desc: 'Zod + AES-256-GCM + contractGuard',                pct: 97 },
  { id: 'alpha-shield',      name: 'Alpha Shield',      model: 'Sonnet', letter: 'AS', module: '_rls',        desc: 'RLS 69/69, CSRF, cifrado, rate limiting',          pct: 100 },
  { id: 'supabase-architect',name: 'Supabase Architect',model: 'Sonnet', letter: 'SA', module: '_db',         desc: '69 tablas, 41 migrations, RLS, tipos TS',          pct: 98 },
  { id: 'ui-designer',       name: 'UI Designer',       model: 'Sonnet', letter: 'UD', module: 'trading',     desc: 'Responsive mobile-first, ARIA, Tailwind 4',        pct: 91 },
  { id: 'deploy-ops',        name: 'Deploy Ops',        model: 'Sonnet', letter: 'DO', module: '_vercel',     desc: 'Vercel deploys, GitHub Actions, CI/CD',            pct: 99 },
  { id: 'perf-optimizer',    name: 'Perf Optimizer',    model: 'Sonnet', letter: 'PO', module: '_db',         desc: 'Queries, bundle size, caching, CWV',               pct: 95 },
  { id: 'test-engineer',     name: 'Test Engineer',     model: 'Sonnet', letter: 'TE', module: '_test',       desc: '19 unit tests Vitest, E2E Playwright',             pct: 85 },
  { id: 'bot-specialist',    name: 'Bot Specialist',    model: 'Sonnet', letter: 'BT', module: 'bot',         desc: 'MT5 heartbeat, telemetría, Copy Groups',           pct: 75 },
  { id: 'feature-completer', name: 'Feature Completer', model: 'Opus',   letter: 'FC', module: 'intelligence',desc: 'P&L, Copy Groups UI, ConstraintSolver',            pct: 50 },
] as const;

const DEFAULT_VERCEL: VercelData = {
  name: 'alphalog-pwa.', framework: 'nextjs', nodeVersion: '24.x',
  latestDeployment: { id: 'dpl_9yCpJ1f61j4Ruov6T8PYMYbGSyRf', readyState: 'READY', createdAt: 1773584023605 },
  domains: ['alphalog.io', 'www.alphalog.io', 'alphalog-pwa.vercel.app'],
  deploys: [
    { msg: 'docs: add comprehensive CLAUDE.md with full project architecture',       state: 'READY', ts: 1773584023605 },
    { msg: 'feat(journal): implement business journal panel with full CRUD',          state: 'READY', ts: 1773578403090 },
    { msg: 'feat(features): wire performance metrics, CSV export, account comparison',state: 'READY', ts: 1773546657018 },
    { msg: 'fix(obs): correct logAuditFromRequest argument order',                   state: 'READY', ts: 1773545625617 },
    { msg: 'obs: audit log on hard-delete, latency tracking, health check',          state: 'ERROR', ts: 1773545416559 },
    { msg: 'ux+obs+test: custom confirm modals, toasts, error boundaries',            state: 'READY', ts: 1773544117690 },
    { msg: 'perf: batch tag queries, paginate evidence, cache headers + indexes',    state: 'READY', ts: 1773539500025 },
    { msg: 'security: harden API auth, CORS, CSRF, and health endpoint',             state: 'READY', ts: 1773537949563 },
    { msg: 'feat: complete all pending TODOs across codebase',                       state: 'READY', ts: 1773520671993 },
    { msg: 'fix(bot-maintenance): keep ACTIVE status unless offline enforcement',    state: 'READY', ts: 1773270804917 },
  ],
};

const STORAGE_KEY = 'alphalog-acc-data';

// ═══ COLORS ═══
const C = {
  bg: '#060a11', sf: '#0c1119', bd: 'rgba(255,255,255,0.05)', bdh: 'rgba(255,255,255,0.1)',
  tx: '#94a3b8', br: '#e2e8f0', dm: '#334155',
  cy: '#22d3ee', gn: '#34d399', yw: '#eab308', rd: '#ef4444',
  op: '#c084fc', sn: '#60a5fa',
  mo: "'IBM Plex Mono','Fira Code',monospace" as const,
  sa: "'Instrument Sans','DM Sans',system-ui,sans-serif" as const,
};
const cd: React.CSSProperties = { background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '14px 16px' };
const pl = (c: string): React.CSSProperties => ({
  fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  padding: '2px 7px', borderRadius: 4, fontFamily: C.mo, color: c,
  background: `${c}14`, border: `1px solid ${c}28`, display: 'inline-block',
});

// ═══ HELPERS ═══
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`;
};
const fmtTs = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  : '--';
const fmtMoney = (n: number | null) => n != null
  ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  : '--';

// ═══ COMPONENTS ═══
function AgentRow({ a, data, vercel, sel, onSel }: {
  a: typeof AGENTS[number];
  data: SupaData | null;
  vercel: VercelData;
  sel: string | null;
  onSel: (id: string) => void;
}) {
  const active = sel === a.id;
  const mc = a.model === 'Opus' ? C.op : C.sn;
  let stLabel: string, stColor: string;

  if (a.module === 'bot') {
    const n = data?.bot?.active ?? 0;
    stLabel = n > 0 ? `${n} ACTIVE` : 'OFFLINE'; stColor = n > 0 ? C.gn : C.rd;
  } else if (a.module === '_vercel') {
    stLabel = vercel.latestDeployment.readyState; stColor = stLabel === 'READY' ? C.gn : C.yw;
  } else if (a.module === '_rls') {
    stLabel = `${data?.snapshot?.rls_enabled ?? 0}/${data?.snapshot?.total_tables ?? 0}`;
    stColor = (data?.snapshot?.rls_enabled ?? 0) === (data?.snapshot?.total_tables ?? 0) ? C.gn : C.yw;
  } else if (a.module === '_db') {
    stLabel = data?.snapshot?.db_size ?? '...'; stColor = C.cy;
  } else if (a.module === '_test') {
    stLabel = '19 tests'; stColor = C.yw;
  } else {
    const mod = data?.[a.module as keyof SupaData] as Record<string, number> | undefined;
    const t = mod ? Object.values(mod).reduce((s, v) => s + v, 0) : 0;
    stLabel = `${t} rows`; stColor = t > 0 ? C.gn : C.dm;
  }

  return (
    <button onClick={() => onSel(a.id)} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', outline: 'none',
      display: 'grid', gridTemplateColumns: '34px 1fr 78px 52px 38px', alignItems: 'center', gap: 8,
      padding: '9px 10px', borderRadius: 7, background: active ? `${C.cy}08` : 'transparent',
      border: active ? `1px solid ${C.cy}20` : '1px solid transparent', transition: 'all 0.15s',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${mc}10`, border: `1px solid ${mc}20`, fontSize: 10, fontWeight: 800, color: mc, fontFamily: C.mo }}>{a.letter}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.br }}>{a.name}</div>
        <div style={{ fontSize: 9.5, color: C.dm, marginTop: 1 }}>{a.desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: stColor, boxShadow: `0 0 5px ${stColor}50` }} />
        <span style={{ fontSize: 9.5, color: stColor, fontFamily: C.mo, fontWeight: 600 }}>{stLabel}</span>
      </div>
      <span style={pl(mc)}>{a.model}</span>
      <div style={{ width: 34, height: 3, borderRadius: 2, background: C.bd, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, width: `${a.pct}%`, background: a.pct >= 95 ? C.gn : a.pct >= 80 ? C.cy : C.yw }} />
      </div>
    </button>
  );
}

function ModuleCard({ name, data, color }: { name: string; data: Record<string, number> | undefined; color: string }) {
  if (!data) return null;
  return (
    <div style={{ ...cd, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{name}</div>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span style={{ fontSize: 10, color: C.tx }}>{k}</span>
          <span style={{ fontSize: 11, color: v > 0 ? C.br : C.dm, fontFamily: C.mo, fontWeight: 600 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Feed<T extends object>({ items, title, getLine }: {
  items: T[] | undefined;
  title: string;
  getLine: (it: T) => { label: string; color: string; sub: string };
}) {
  return (
    <div style={cd}>
      <div style={{ fontSize: 9, color: C.tx, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>{title}</div>
      {(!items || !items.length) && <div style={{ fontSize: 10, color: C.dm, fontStyle: 'italic' }}>Empty</div>}
      {items?.slice(0, 6).map((it, i) => {
        const { label, color: lc, sub } = getLine(it);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderBottom: i < 5 ? `1px solid ${C.bd}` : 'none' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: lc, marginTop: 5, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: C.br, fontFamily: C.mo, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
              <div style={{ fontSize: 9, color: C.dm, marginTop: 1 }}>{sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ MAIN ═══
export default function CommandCenterPanel() {
  const [supa, setSupa] = useState<SupaData | null>(null);
  const [vercel] = useState<VercelData>(DEFAULT_VERCEL);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'agents' | 'modules' | 'bot' | 'deploys'>('agents');
  const [dataTs, setDataTs] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());

  const fetchData = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/command-center');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SupaData = await res.json();
      setSupa(data);
      const ts = new Date().toISOString();
      setDataTs(ts);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ supa: data, ts })); } catch { /* silent */ }
      if (showToast) toast.success('Data refreshed');
    } catch {
      if (showToast) toast.error('Refresh failed');
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) { const p = JSON.parse(stored); if (p.supa) { setSupa(p.supa); setDataTs(p.ts); } }
      } catch { /* silent */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) { const p = JSON.parse(stored); if (p.supa) { setSupa(p.supa); setDataTs(p.ts); } }
    } catch { /* silent */ }
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const snap = supa?.snapshot;
  const selAgent = AGENTS.find(a => a.id === sel);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.tx, fontFamily: C.sa, padding: 16, backgroundImage: `radial-gradient(ellipse at 15% 0%,rgba(34,211,238,0.025) 0%,transparent 50%),radial-gradient(ellipse at 85% 100%,rgba(192,132,252,0.015) 0%,transparent 50%)` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:2px}
        button:focus-visible{outline:2px solid ${C.cy};outline-offset:2px}
      `}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.gn, boxShadow: `0 0 8px ${C.gn}40` }} />
          <h1 style={{ fontSize: 17, fontWeight: 700, color: C.br, letterSpacing: '-0.03em', margin: 0 }}>Agent Command Center</h1>
          <span style={pl(C.cy)}>LIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 5, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: C.mo, border: `1px solid ${C.cy}30`, color: loading ? C.dm : C.cy, background: `${C.cy}08`, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'LOADING...' : 'REFRESH'}
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.dm, fontFamily: C.mo }}>{clock.toLocaleTimeString('en-US', { hour12: false })}</div>
            <div style={{ fontSize: 8, color: C.dm }}>data: {dataTs ? ago(dataTs) + ' ago' : '...'}</div>
          </div>
        </div>
      </div>

      {/* TOP METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 7, marginBottom: 12 }}>
        {[
          { l: 'Tables', v: snap?.total_tables ?? '…', c: C.br },
          { l: 'RLS', v: snap ? `${snap.rls_enabled}/${snap.total_tables}` : '…', c: snap?.rls_enabled === snap?.total_tables ? C.gn : C.rd },
          { l: 'Rows', v: snap?.total_rows ?? '…', c: C.cy },
          { l: 'DB', v: snap?.db_size ?? '…', c: C.br },
          { l: 'Deploy', v: vercel.latestDeployment.readyState, c: C.gn },
          { l: 'Domains', v: vercel.domains.length, c: C.br },
          { l: 'Bot', v: supa ? `${supa.bot.active}/${supa.bot.instances}` : '…', c: (supa?.bot?.active ?? 0) > 0 ? C.gn : C.rd },
        ].map((m, i) => (
          <div key={i} style={{ ...cd, padding: '10px 12px' }}>
            <div style={{ fontSize: 8, color: C.tx, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{m.l}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: m.c, fontFamily: C.mo, lineHeight: 1 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {([['agents', 'Agents (10)'], ['modules', 'Modules'], ['bot', 'Bot / MT5'], ['deploys', 'Vercel Deploys']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            fontSize: 10, fontWeight: 600, padding: '5px 11px', borderRadius: 5, cursor: 'pointer',
            border: `1px solid ${tab === k ? C.cy + '30' : C.bd}`, color: tab === k ? C.cy : C.tx, background: tab === k ? `${C.cy}08` : 'transparent',
          }}>{l}</button>
        ))}
      </div>

      {/* ══ AGENTS ══ */}
      {tab === 'agents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 10 }}>
          <div style={cd}>
            <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr 78px 52px 38px', gap: 8, padding: '0 10px 5px', fontSize: 8, color: C.dm, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.bd}` }}>
              <span /><span>Agent</span><span>Status</span><span>Model</span><span>%</span>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {AGENTS.map(a => <AgentRow key={a.id} a={a} data={supa} vercel={vercel} sel={sel} onSel={setSel} />)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selAgent ? (
              <div style={cd}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: `${selAgent.model === 'Opus' ? C.op : C.sn}12`, border: `1px solid ${selAgent.model === 'Opus' ? C.op : C.sn}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: selAgent.model === 'Opus' ? C.op : C.sn, fontFamily: C.mo }}>{selAgent.letter}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.br }}>{selAgent.name}</div>
                    <div style={{ fontSize: 10, color: C.tx }}>{selAgent.desc}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: C.tx }}>Module completeness</span>
                    <span style={{ fontSize: 10, fontFamily: C.mo, fontWeight: 700, color: selAgent.pct >= 95 ? C.gn : selAgent.pct >= 80 ? C.cy : C.yw }}>{selAgent.pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: C.bd }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${selAgent.pct}%`, background: selAgent.pct >= 95 ? C.gn : selAgent.pct >= 80 ? C.cy : C.yw, transition: 'width 0.4s' }} />
                  </div>
                </div>
                {!selAgent.module.startsWith('_') && supa && (supa[selAgent.module as keyof SupaData] as Record<string, number> | undefined) && (
                  <div>
                    <div style={{ fontSize: 9, color: C.dm, textTransform: 'uppercase', marginBottom: 5 }}>Supabase Data</div>
                    {Object.entries(supa[selAgent.module as keyof SupaData] as Record<string, number>).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span style={{ fontSize: 10, color: C.tx }}>{k}</span>
                        <span style={{ fontSize: 11, fontFamily: C.mo, fontWeight: 600, color: v > 0 ? C.br : C.dm }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {selAgent.module === '_rls' && <div style={{ fontSize: 11, color: C.gn, fontFamily: C.mo, fontWeight: 700 }}>69/69 RLS enabled</div>}
                {selAgent.module === '_db' && snap && <div style={{ fontSize: 11, color: C.cy, fontFamily: C.mo }}>{snap.total_tables} tables / {snap.total_rows} rows / {snap.db_size}</div>}
                {selAgent.module === '_vercel' && <div style={{ fontSize: 11, color: C.gn, fontFamily: C.mo }}>{vercel.latestDeployment.readyState} / {vercel.domains.length} domains / Node {vercel.nodeVersion}</div>}
                {selAgent.module === '_test' && <div style={{ fontSize: 11, color: C.yw, fontFamily: C.mo }}>19 unit tests (Vitest) + E2E auth smoke (Playwright)</div>}
              </div>
            ) : (
              <div style={{ ...cd, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, color: C.dm, fontSize: 11, fontStyle: 'italic' }}>Select an agent</div>
            )}
            <Feed
              items={supa?.app_logs}
              title="App Logs"
              getLine={(it: AppLog) => ({ label: it.message, color: C.tx, sub: `${it.area} / ${fmtTs(it.created_at)}` })}
            />
          </div>
        </div>
      )}

      {/* ══ MODULES ══ */}
      {tab === 'modules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <ModuleCard name="Trading"      data={supa?.trading}      color={C.cy} />
          <ModuleCard name="Business"     data={supa?.business}     color={C.gn} />
          <ModuleCard name="Bot Control"  data={supa?.bot}          color={C.yw} />
          <ModuleCard name="Intelligence" data={supa?.intelligence}  color={C.op} />
          <ModuleCard name="Terminal"     data={supa?.terminal}     color={C.sn} />
          <ModuleCard name="Security"     data={supa?.security}     color={C.rd} />
        </div>
      )}

      {/* ══ BOT ══ */}
      {tab === 'bot' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={cd}>
              <div style={{ fontSize: 9, color: C.tx, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>MT5 Telemetry</div>
              {(supa?.telemetry ?? []).map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, padding: '7px 10px', borderRadius: 6, background: C.bg, border: `1px solid ${C.bd}`, marginBottom: 5 }}>
                  <div><div style={{ fontSize: 8, color: C.dm, textTransform: 'uppercase' }}>Balance</div><div style={{ fontSize: 13, fontWeight: 700, color: t.balance ? C.gn : C.dm, fontFamily: C.mo }}>{fmtMoney(t.balance)}</div></div>
                  <div><div style={{ fontSize: 8, color: C.dm, textTransform: 'uppercase' }}>Equity</div><div style={{ fontSize: 13, fontWeight: 700, color: t.equity ? C.cy : C.dm, fontFamily: C.mo }}>{fmtMoney(t.equity)}</div></div>
                  <div><div style={{ fontSize: 8, color: C.dm, textTransform: 'uppercase' }}>Pos</div><div style={{ fontSize: 13, fontWeight: 700, color: C.br, fontFamily: C.mo }}>{t.positions_total ?? '--'}</div></div>
                  <div><div style={{ fontSize: 8, color: C.dm, textTransform: 'uppercase' }}>Tier</div><div style={{ fontSize: 10, fontWeight: 600, color: C.tx, fontFamily: C.mo }}>{t.tier ?? '--'}</div></div>
                </div>
              ))}
            </div>
            <div style={cd}>
              <div style={{ fontSize: 9, color: C.tx, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>Bot Instances</div>
              {(supa?.bot_instances ?? []).map((inst, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 2 ? `1px solid ${C.bd}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: inst.status === 'ACTIVE' ? C.gn : C.rd, boxShadow: inst.status === 'ACTIVE' ? `0 0 6px ${C.gn}50` : 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: inst.status === 'ACTIVE' ? C.gn : C.rd, fontFamily: C.mo }}>{inst.status}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: C.dm, fontFamily: C.mo }}>{inst.instance_id?.slice(5, 25)}</div>
                    <div style={{ fontSize: 9, color: C.tx }}>HB: {ago(inst.last_heartbeat_at)} ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Feed
              items={supa?.bot_events}
              title="Bot Events"
              getLine={(it: BotEvent) => ({
                label: it.event_type,
                color: it.event_type.includes('TIMEOUT') ? C.rd : it.event_type.includes('RECOVERY') ? C.yw : C.tx,
                sub: `${(it.payload?.severity as string) ?? ''} ${(it.payload?.profile as string) ?? ''} / ${fmtTs(it.created_at)}`,
              })}
            />
            <Feed
              items={supa?.bot_commands}
              title="Bot Commands"
              getLine={(it: BotCommand) => ({ label: it.command_type, color: it.status === 'FAILED' ? C.rd : C.gn, sub: `${it.status} / ${fmtTs(it.created_at)}` })}
            />
          </div>
        </div>
      )}

      {/* ══ DEPLOYS ══ */}
      {tab === 'deploys' && (
        <div style={cd}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: C.tx, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Vercel Production Deploys</div>
            <span style={pl(C.gn)}>{vercel.deploys.filter(d => d.state === 'READY').length} ready</span>
            {vercel.deploys.filter(d => d.state === 'ERROR').length > 0 && <span style={pl(C.rd)}>{vercel.deploys.filter(d => d.state === 'ERROR').length} error</span>}
            <span style={{ fontSize: 10, color: C.dm, fontFamily: C.mo, marginLeft: 'auto' }}>nextjs / Node {vercel.nodeVersion}</span>
          </div>
          {vercel.deploys.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < vercel.deploys.length - 1 ? `1px solid ${C.bd}` : 'none' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.state === 'READY' ? C.gn : C.rd, flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, color: C.br, fontFamily: C.mo, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.msg}</span>
              <span style={pl(d.state === 'READY' ? C.gn : C.rd)}>{d.state}</span>
              <span style={{ fontSize: 9, color: C.dm, fontFamily: C.mo, flexShrink: 0, minWidth: 60, textAlign: 'right' }}>{new Date(d.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}

      {/* FOOTER */}
      <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C.bd}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <span style={{ fontSize: 9, color: C.dm, fontFamily: C.mo }}>alphalog.io / supabase:jgkvnnl... / vercel:iad1 / 69 tables RLS</span>
        <span style={{ fontSize: 9, color: C.dm }}>Live data via /api/dashboard/command-center — refreshed every click</span>
      </div>
    </div>
  );
}
