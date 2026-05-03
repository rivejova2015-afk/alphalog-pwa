/**
 * Coinarb 50x — process entry.
 *
 * Boots feeds → loads product cache → wires real or paper brokers → starts loop.
 * Designed for Fly.io: SIGTERM-aware, exits cleanly so Fly restarts on crash.
 */

import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadFiftyXAgentConfig } from './config-50x.js';
import { CoinbaseFeed } from '../../feeds/coinbase-ws.js';
import { BinanceFeed } from '../../feeds/binance-ws.js';
import { CoinbaseIntxFeed } from '../../feeds/coinbase-intx-ws.js';
import { CoinbaseSpotOrders } from '../../trading/coinbase-spot-orders.js';
import { CoinbaseIntxOrders } from '../../trading/coinbase-intx-orders.js';
import { PaperSpotBroker, PaperPerpBroker, type SpotBroker, type PerpBroker } from '../../paper/paper-broker.js';
import { CoinarbLoop } from './loop-50x.js';

interface ProductCache {
  generatedAt?: string;
  spot: Record<string, { baseMinSize: number; baseIncrement: number; priceIncrement: number; status: string }>;
  perp: Record<string, { minOrderSize: number; baseIncrement: number; quoteIncrement: number; status: string }>;
}

const CACHE_PATH = join(tmpdir(), 'coinarb-products.json');

async function loadProductCache(paperMode: boolean): Promise<ProductCache> {
  try {
    const raw = await readFile(CACHE_PATH, 'utf8');
    return JSON.parse(raw) as ProductCache;
  } catch {
    if (!paperMode) {
      throw new Error(
        `Missing product cache at ${CACHE_PATH}. Run \`npm run boot:products\` before starting in LIVE mode.`,
      );
    }
    console.warn(`[index] no product cache — defaulting to paper increments`);
    return {
      spot: {
        'BTC-USD': { baseMinSize: 0.0001, baseIncrement: 0.00000001, priceIncrement: 0.01, status: 'paper' },
        'ETH-USD': { baseMinSize: 0.001,  baseIncrement: 0.00000001, priceIncrement: 0.01, status: 'paper' },
      },
      perp: {
        'BTC-PERP': { minOrderSize: 0.0001, baseIncrement: 0.0001, quoteIncrement: 0.1, status: 'paper' },
        'ETH-PERP': { minOrderSize: 0.001,  baseIncrement: 0.001,  quoteIncrement: 0.01, status: 'paper' },
      },
    };
  }
}

async function main(): Promise<void> {
  const config = await loadFiftyXAgentConfig();
  console.log(`[index] coinarb-50x — agent=${config.agentId} user=${config.userId} mode=${config.paperMode ? 'PAPER' : 'LIVE'}`);

  // Live-mode credential gate — fail loud rather than silently fall back to paper.
  if (!config.paperMode) {
    if (!config.cdpKeyName || !config.cdpPrivateKey) {
      throw new Error('LIVE mode requires COINBASE_CDP_KEY_NAME + COINBASE_CDP_PRIVATE_KEY');
    }
    if (!config.intxApiKey || !config.intxSecret || !config.intxPassphrase || !config.intxPortfolioId) {
      throw new Error('LIVE mode requires COINBASE_INTX_* (key/secret/passphrase/portfolio_id)');
    }
  }

  const productCache = await loadProductCache(config.paperMode);

  const coinbaseFeed = new CoinbaseFeed();
  const binanceFeed  = new BinanceFeed();
  const intxFeed     = new CoinbaseIntxFeed(['BTC-PERP', 'ETH-PERP']);
  coinbaseFeed.start();
  binanceFeed.start();

  // Coinbase International market-data WS requires JWT auth even for public LEVEL1.
  // In paper mode without creds we skip the feed — perp paper orders will fail with
  // no_quote (logged, non-fatal) and the bot trades spot-only until creds are set.
  const intxEnabled = !config.paperMode || Boolean(config.intxApiKey && config.intxSecret && config.intxPassphrase);
  if (intxEnabled) {
    intxFeed.start();
    console.log('[index] INTX feed started');
  } else {
    console.log('[index] INTX feed disabled (paper mode, no INTX credentials) — spot-only');
  }

  let spotBroker: SpotBroker;
  let perpBroker: PerpBroker;
  if (config.paperMode) {
    spotBroker = new PaperSpotBroker(coinbaseFeed);
    perpBroker = new PaperPerpBroker(intxFeed);
    console.log('[index] PAPER brokers wired');
  } else {
    spotBroker = new CoinbaseSpotOrders({
      keyName: config.cdpKeyName!,
      privateKey: config.cdpPrivateKey!,
    });
    perpBroker = new CoinbaseIntxOrders(
      { apiKey: config.intxApiKey!, secret: config.intxSecret!, passphrase: config.intxPassphrase! },
      config.intxPortfolioId!,
    );
    console.log('[index] LIVE brokers wired');
  }

  const loop = new CoinarbLoop({
    config,
    coinbaseFeed,
    binanceFeed,
    intxFeed,
    spotBroker,
    perpBroker,
    productCache,
  });

  await loop.start();

  const shutdown = (sig: string) => {
    console.log(`[index] ${sig} — shutting down`);
    loop.stop();
    coinbaseFeed.stop();
    binanceFeed.stop();
    if (intxEnabled) intxFeed.stop();
    setTimeout(() => process.exit(0), 500);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('[index] fatal:', err);
  process.exit(1);
});
