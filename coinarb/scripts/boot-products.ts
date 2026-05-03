/**
 * Fetches product / instrument metadata from Coinbase at boot and caches it
 * to /tmp/coinarb-products.json. Used by the loop to round Kelly-sized orders
 * to the nearest valid increment.
 *
 * Fails loud if any required product is missing or its min_size > maxAffordable
 * given current capital + Kelly cap.
 *
 * Usage:  npx tsx scripts/boot-products.ts
 */

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadCoinarbConfig } from '../src/config.js';
import { CoinbaseSpotOrders } from '../src/trading/coinbase-spot-orders.js';
import { CoinbaseIntxOrders } from '../src/trading/coinbase-intx-orders.js';

const SPOT_PRODUCTS = ['BTC-USD', 'ETH-USD'];
const PERP_INSTRUMENTS = ['BTC-PERP', 'ETH-PERP'];
const CACHE_PATH = join(tmpdir(), 'coinarb-products.json');

interface ProductCache {
  generatedAt: string;
  spot: Record<string, { baseMinSize: number; baseIncrement: number; priceIncrement: number; status: string }>;
  perp: Record<string, { minOrderSize: number; baseIncrement: number; quoteIncrement: number; status: string }>;
}

async function main(): Promise<void> {
  const cfg = await loadCoinarbConfig();
  const cache: ProductCache = {
    generatedAt: new Date().toISOString(),
    spot: {},
    perp: {},
  };

  if (cfg.cdpKeyName && cfg.cdpPrivateKey) {
    const spot = new CoinbaseSpotOrders({
      keyName: cfg.cdpKeyName,
      privateKey: cfg.cdpPrivateKey,
    });
    for (const productId of SPOT_PRODUCTS) {
      const p = await spot.getProduct(productId);
      cache.spot[productId] = {
        baseMinSize: p.baseMinSize,
        baseIncrement: p.baseIncrement,
        priceIncrement: p.priceIncrement,
        status: p.status,
      };
      console.log(`[spot]  ${productId}  min=${p.baseMinSize}  step=${p.baseIncrement}  status=${p.status}`);
    }
  } else {
    console.warn('[spot] CDP credentials missing, skipping spot product fetch');
  }

  if (cfg.intxApiKey && cfg.intxSecret && cfg.intxPassphrase && cfg.intxPortfolioId) {
    const perp = new CoinbaseIntxOrders(
      { apiKey: cfg.intxApiKey, secret: cfg.intxSecret, passphrase: cfg.intxPassphrase },
      cfg.intxPortfolioId,
    );
    for (const symbol of PERP_INSTRUMENTS) {
      const i = await perp.getInstrument(symbol);
      cache.perp[symbol] = {
        minOrderSize: i.minOrderSize,
        baseIncrement: i.baseIncrement,
        quoteIncrement: i.quoteIncrement,
        status: i.status,
      };
      console.log(`[perp]  ${symbol}  min=${i.minOrderSize}  step=${i.baseIncrement}  status=${i.status}`);
    }
  } else {
    console.warn('[perp] INTX credentials missing, skipping perp instrument fetch');
  }

  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`\nCached to ${CACHE_PATH}`);

  // Sanity check: max affordable trade ~ Kelly fraction × allocation × capital.
  const maxAffordableSpot = cfg.params.maxKellyFraction * cfg.params.spotAllocationPct * cfg.startingCapitalUsd;
  console.log(`\nSanity:  max-affordable-spot=$${maxAffordableSpot.toFixed(2)}  (Kelly ${cfg.params.maxKellyFraction} × spot pct ${cfg.params.spotAllocationPct} × $${cfg.startingCapitalUsd})`);
}

main().catch((err) => {
  console.error('boot-products failed:', err);
  process.exit(1);
});
