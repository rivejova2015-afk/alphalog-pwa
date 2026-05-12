/**
 * Coinarb entry point.
 *
 * Reads CDP creds from env (only when not in PAPER mode), constructs the loop
 * with the live order client, and starts the tick. SIGTERM/SIGINT shut down
 * cleanly so Fly's rolling deploys don't leave WS connections orphaned.
 */

import 'dotenv/config';
import { buildLoop } from './loop.js';
import { PAPER_MODE, loadConfigFromDb } from './config.js';
import type { CdpCredentials } from '../trading/coinbase-cdp-auth.js';

function readCdpCreds(): CdpCredentials | undefined {
  const keyName = process.env.COINBASE_CDP_KEY_NAME;
  const privateKey = process.env.COINBASE_CDP_PRIVATE_KEY;
  if (!keyName || !privateKey) return undefined;
  return { keyName, privateKey: privateKey.replace(/\\n/g, '\n') };
}

async function main(): Promise<void> {
  // Fase B — Pull tunable thresholds from algorithms.parameters before the
  // loop is constructed. Live ES-module bindings mean callers don't need
  // refactoring; if this throws, we keep the env-var defaults.
  await loadConfigFromDb();

  const creds = readCdpCreds();
  if (!PAPER_MODE && !creds) {
    console.warn('[coinarb] LIVE mode requested but COINBASE_CDP_* not set — falling back to paper');
  }

  const loop = buildLoop(creds);

  const shutdown = (signal: string) => {
    console.log(`[coinarb] received ${signal}, shutting down`);
    loop.stop();
    setTimeout(() => process.exit(0), 1_000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  loop.start();
  console.log(`[coinarb] running (${PAPER_MODE ? 'PAPER' : 'LIVE'})`);
}

main().catch((err) => {
  console.error('[coinarb] fatal:', err);
  process.exit(1);
});
