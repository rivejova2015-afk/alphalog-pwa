/**
 * Pre-LIVE flight check — validates that the bot is ready to trade real money
 * WITHOUT placing any orders.
 *
 * Runs the same auth path the live loop uses (CDP JWT signing → Coinbase
 * Advanced Trade REST), but only against READ endpoints. Returns OK/NOT READY
 * with specific reasons so you can fix env / fund / permissions one at a time
 * before flipping COINARB_50X_PAPER_MODE=false in production.
 *
 * Checks:
 *   1. PAPER_MODE flag state (warns if already false without creds)
 *   2. CDP creds present (COINBASE_CDP_KEY_NAME + COINBASE_CDP_PRIVATE_KEY)
 *   3. CDP JWT signs correctly (catches malformed private keys)
 *   4. /api/v3/brokerage/accounts returns 200 (auth + scope work)
 *   5. USD portfolio balance > 0 (without this, orders fail INSUFFICIENT_FUND)
 *   6. Product info for BTC-USD reachable (price feed + min-size sanity check)
 *
 * Usage:
 *   # Locally with your env vars exported:
 *   cd coinarb && npx tsx scripts/preflight-live.ts
 *
 *   # On Fly machine (uses live secrets):
 *   flyctl ssh console -a coinarb-50x
 *   cd /app && node dist/scripts/preflight-live.js   # after building
 */

import 'dotenv/config';
import { fetch } from 'undici';
import { buildCdpJwt, type CdpCredentials } from '../src/trading/coinbase-cdp-auth.js';

const HOST = 'api.coinbase.com';
const BASE = `https://${HOST}`;

type CheckResult = { name: string; status: 'OK' | 'FAIL' | 'WARN'; detail: string };
const results: CheckResult[] = [];

function record(name: string, status: 'OK' | 'FAIL' | 'WARN', detail: string): void {
  results.push({ name, status, detail });
  const icon = status === 'OK' ? '✓' : status === 'WARN' ? '!' : '✗';
  const color = status === 'OK' ? '\x1b[32m' : status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name.padEnd(40)} ${detail}`);
}

async function main(): Promise<void> {
  console.log('\nCoinarb LIVE mode preflight\n' + '─'.repeat(60));

  // ─── 1. PAPER_MODE flag state ─────────────────────────────────────────
  const paperMode = process.env.COINARB_50X_PAPER_MODE ?? 'true';
  if (paperMode === 'true') {
    record('PAPER_MODE flag', 'OK', 'COINARB_50X_PAPER_MODE=true (safe — bot runs paper)');
  } else {
    record('PAPER_MODE flag', 'WARN', 'COINARB_50X_PAPER_MODE=false (LIVE requested — checks below decide if creds back it up)');
  }

  // ─── 2. CDP creds present ─────────────────────────────────────────────
  const keyName = process.env.COINBASE_CDP_KEY_NAME;
  const privateKey = process.env.COINBASE_CDP_PRIVATE_KEY;
  if (!keyName || !privateKey) {
    record('CDP creds present', 'FAIL', `Missing ${!keyName ? 'COINBASE_CDP_KEY_NAME' : 'COINBASE_CDP_PRIVATE_KEY'} — bot will fall back to paper`);
    summary();
    return;
  }
  record('CDP creds present', 'OK', `keyName=${keyName.split('/').pop() ?? '???'} (${privateKey.length} chars in private key)`);

  const creds: CdpCredentials = { keyName, privateKey: privateKey.replace(/\\n/g, '\n') };

  // ─── 3. CDP JWT signs ──────────────────────────────────────────────────
  let token: string;
  try {
    token = await buildCdpJwt(creds, 'GET', HOST, '/api/v3/brokerage/accounts');
    record('CDP JWT signs', 'OK', `ES256 token (${token.length} chars)`);
  } catch (err) {
    record('CDP JWT signs', 'FAIL', err instanceof Error ? err.message : String(err));
    summary();
    return;
  }

  // ─── 4. Auth scope: /accounts returns 200 ─────────────────────────────
  let accountsResponse: { accounts?: Array<{ currency: string; available_balance: { value: string }; type?: string }> } | null = null;
  try {
    const res = await fetch(`${BASE}/api/v3/brokerage/accounts`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      record('Auth scope (/accounts)', 'FAIL', `HTTP ${res.status} — ${body.slice(0, 200)}`);
      summary();
      return;
    }
    accountsResponse = await res.json() as typeof accountsResponse;
    const count = accountsResponse?.accounts?.length ?? 0;
    record('Auth scope (/accounts)', 'OK', `HTTP 200, ${count} accounts visible`);
  } catch (err) {
    record('Auth scope (/accounts)', 'FAIL', err instanceof Error ? err.message : String(err));
    summary();
    return;
  }

  // ─── 5. USD balance > 0 ────────────────────────────────────────────────
  const usdAccount = accountsResponse?.accounts?.find(a => a.currency === 'USD');
  if (!usdAccount) {
    record('USD balance', 'FAIL', 'No USD account found in portfolio — fund the account first');
  } else {
    const balance = Number(usdAccount.available_balance.value);
    if (Number.isFinite(balance) && balance >= 20) {
      record('USD balance', 'OK', `$${balance.toFixed(2)} available (≥ $20 recommended for safe first trade)`);
    } else if (Number.isFinite(balance) && balance > 0) {
      record('USD balance', 'WARN', `$${balance.toFixed(2)} available (below $20 — consider funding more before first LIVE trade)`);
    } else {
      record('USD balance', 'FAIL', `$${balance.toFixed(2)} — orders will fail INSUFFICIENT_FUND`);
    }
  }

  // ─── 6. Product info for BTC-USD ──────────────────────────────────────
  try {
    const productToken = await buildCdpJwt(creds, 'GET', HOST, '/api/v3/brokerage/products/BTC-USD');
    const res = await fetch(`${BASE}/api/v3/brokerage/products/BTC-USD`, {
      headers: { Authorization: `Bearer ${productToken}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      record('Product BTC-USD reachable', 'FAIL', `HTTP ${res.status}`);
    } else {
      const product = await res.json() as { price?: string; status?: string; trading_disabled?: boolean };
      const detail = `last=$${product.price ?? '?'} status=${product.status ?? '?'}${product.trading_disabled ? ' TRADING DISABLED' : ''}`;
      if (product.trading_disabled) {
        record('Product BTC-USD reachable', 'WARN', detail);
      } else {
        record('Product BTC-USD reachable', 'OK', detail);
      }
    }
  } catch (err) {
    record('Product BTC-USD reachable', 'FAIL', err instanceof Error ? err.message : String(err));
  }

  summary();
}

function summary(): void {
  console.log('\n' + '─'.repeat(60));
  const fails = results.filter(r => r.status === 'FAIL').length;
  const warns = results.filter(r => r.status === 'WARN').length;
  const oks = results.filter(r => r.status === 'OK').length;

  if (fails > 0) {
    console.log(`\x1b[31m✗ NOT READY — ${fails} failed, ${warns} warned, ${oks} OK\x1b[0m`);
    console.log('  → Fix the failures above before flipping COINARB_50X_PAPER_MODE=false.');
    process.exit(1);
  } else if (warns > 0) {
    console.log(`\x1b[33m! READY WITH WARNINGS — ${warns} warned, ${oks} OK\x1b[0m`);
    console.log('  → Review the warnings. You CAN go live but they may bite at first trade.');
    process.exit(0);
  } else {
    console.log(`\x1b[32m✓ READY — ${oks} checks passed\x1b[0m`);
    console.log('  → Safe to set COINARB_50X_PAPER_MODE=false. Start with a small position.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ preflight crashed:\x1b[0m', err);
  process.exit(2);
});
