/**
 * Polymarket CLOB REST feed — parallel orderbook polling.
 *
 * Optimizations:
 * - Orderbooks fetched in parallel (Promise.allSettled) — not sequentially
 * - Polling lock prevents overlapping cycles
 * - Dead market filter: skip markets with 0 liquidity for 5 consecutive polls
 * - Stale cache: skip fetch if data is <1.5s old (prevents redundant polls on slow cycles)
 * - Orderbook reads use direct fetch (no proxy) — public endpoint, not geoblocked
 * - Proxy is reserved exclusively for order placement / cancel / balance
 */

export interface PolymarketOrderbook {
  marketSlug: string;
  conditionId: string;
  bidPrice: number;
  askPrice: number;
  midPrice: number;
  spread: number;
  bidSize: number;
  askSize: number;
  lastTradePrice: number;
  timestamp: number;
}

export interface PolymarketMarket {
  slug: string;
  conditionId: string;
  question: string;
  endDate: string;
  active: boolean;
  yesTokenId: string;
  noTokenId: string;
}

import { clobFetchDirect } from '../lib/clob-fetch.js';

const CLOB_REST_BASE = 'https://clob.polymarket.com';
const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const POLL_INTERVAL_MS = 3_000;        // poll every 3s — sufficient for prediction markets
const STALE_THRESHOLD_MS = 1_500;      // skip if last fetch was <1.5s ago
const DEAD_MARKET_THRESHOLD = 5;       // drop market after 5 consecutive empty orderbooks

export class PolymarketFeed {
  private markets: Map<string, PolymarketMarket> = new Map();
  private orderbooks: Map<string, PolymarketOrderbook> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private shouldRun = false;
  private trackedConditionIds: string[] = [];
  private polling = false;
  private lastFetchAt: Map<string, number> = new Map();
  private emptyStreak: Map<string, number> = new Map();  // consecutive empty polls

  onOrderbookUpdate: ((
    conditionId: string,
    bidSize: number,
    askSize: number,
    bidPrice: number,
    askPrice: number,
  ) => void) | null = null;

  get isConnected(): boolean {
    return this.shouldRun && this.orderbooks.size > 0;
  }

  getMarkets(): PolymarketMarket[] {
    return Array.from(this.markets.values());
  }

  getOrderbook(conditionId: string): PolymarketOrderbook | null {
    return this.orderbooks.get(conditionId) ?? null;
  }

  getAllOrderbooks(): PolymarketOrderbook[] {
    return Array.from(this.orderbooks.values());
  }

  start(conditionIds: string[]): void {
    this.trackedConditionIds = conditionIds;
    this.shouldRun = true;
    console.log(`[polymarket-ws] Starting REST poll for ${conditionIds.length} markets`);
    void this.pollOrderbooks();
    this.pollTimer = setInterval(() => {
      void this.pollOrderbooks();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    this.shouldRun = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[polymarket-ws] Stopped');
  }

  async fetchCryptoMarkets(): Promise<PolymarketMarket[]> {
    try {
      // Fetch active markets — gamma API doesn't support reliable sort params,
      // so we fetch a large batch and sort client-side by endDate
      const res = await fetch(
        `${GAMMA_BASE}/markets?active=true&closed=false&limit=1000`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15_000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json() as Array<{
        conditionId?: string;
        question?: string;
        endDate?: string;
        active?: boolean;
        slug?: string;
        outcomes?: string[];
        clobTokenIds?: string;
      }>;

      const data = Array.isArray(raw) ? raw : [];
      const cryptoMarkets: PolymarketMarket[] = [];

      for (const m of data) {
        const q = (m.question ?? '').toLowerCase();

        // Word-boundary regex — prevents false positives like:
        // "Hegseth" matching \beth\b, "Solanke" matching \bsol\b,
        // "Netherlands" matching \beth\b
        const isCrypto =
          /\bbtc\b/.test(q) || /\bbitcoin\b/.test(q) ||
          /\beth\b/.test(q) || /\bethereum\b/.test(q) ||
          /\bsol\b/.test(q) || /\bsolana\b/.test(q) ||
          /\bdoge\b/.test(q) || /\bdogecoin\b/.test(q) ||
          /\bxrp\b/.test(q) || /\bripple\b/.test(q) ||
          /\bada\b/.test(q) || /\bcardano\b/.test(q) ||
          /\bavax\b/.test(q) || /\bavalanche\b/.test(q) ||
          /\bmatic\b/.test(q) || /\bpolygon\b/.test(q) ||
          /\blink\b/.test(q) || /\bchainlink\b/.test(q) ||
          /\bbnb\b/.test(q) || /\bshib\b/.test(q) ||
          /\bcrypto\b/.test(q) || /\bcoinbase\b/.test(q) ||
          /\bbinance\b/.test(q) || /\bstablecoin\b/.test(q) ||
          /\bdefi\b/.test(q) || /\bnft\b/.test(q) ||
          /\baltcoin\b/.test(q) || /\bblockchain\b/.test(q);

        if (!isCrypto) continue;

        let outcomes: string[] = [];
        let tokenIds: string[] = [];
        try {
          outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) as string[] : (m.outcomes ?? []);
          tokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) as string[] : [];
        } catch { continue; }

        if (outcomes.length !== 2) continue;

        const yesIdx = outcomes.findIndex(o => o.toLowerCase() === 'yes');
        const noIdx  = outcomes.findIndex(o => o.toLowerCase() === 'no');
        const yesTokenId = tokenIds[yesIdx >= 0 ? yesIdx : 0] ?? '';
        const noTokenId  = tokenIds[noIdx  >= 0 ? noIdx  : 1] ?? '';

        if (!yesTokenId || !m.conditionId) continue;

        cryptoMarkets.push({
          slug: m.slug ?? '',
          conditionId: m.conditionId,
          question: m.question ?? '',
          endDate: m.endDate ?? '',
          active: m.active ?? true,
          yesTokenId,
          noTokenId,
        });
      }

      // Sort by expiry: soonest first (5min > 15min > 1h > 4h > daily > weekly)
      cryptoMarkets.sort((a, b) =>
        new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
      );

      // Cap at 60 markets — enough variety, avoids polling overload
      const selected = cryptoMarkets.slice(0, 60);

      for (const market of selected) {
        this.markets.set(market.conditionId, market);
        this.emptyStreak.delete(market.conditionId);
      }

      console.log(`[polymarket-ws] Found ${cryptoMarkets.length} crypto markets → tracking top ${selected.length} by soonest expiry`);
      return selected;
    } catch (err) {
      console.error('[polymarket-ws] Market fetch error:', err);
      return [];
    }
  }

  private async pollOrderbooks(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      // Filter out dead markets (consistently empty) to save requests
      const active = this.trackedConditionIds.filter(id => {
        const streak = this.emptyStreak.get(id) ?? 0;
        return streak < DEAD_MARKET_THRESHOLD;
      });

      await Promise.allSettled(
        active.map(conditionId => this.fetchOneOrderbook(conditionId))
      );
    } finally {
      this.polling = false;
    }
  }

  private async fetchOneOrderbook(conditionId: string): Promise<void> {
    // Skip if data is fresh enough
    const lastFetch = this.lastFetchAt.get(conditionId) ?? 0;
    if (Date.now() - lastFetch < STALE_THRESHOLD_MS) return;

    try {
      const market = this.markets.get(conditionId);
      const tokenId = market?.yesTokenId || conditionId;

      // Direct fetch — orderbooks are public, no geoblock, no proxy needed
      const res = await clobFetchDirect(
        `${CLOB_REST_BASE}/book?token_id=${tokenId}`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4_000) }
      );

      this.lastFetchAt.set(conditionId, Date.now());

      if (!res.ok) return;

      const book = await res.json() as {
        bids?: Array<{ price: string; size: string }>;
        asks?: Array<{ price: string; size: string }>;
      };

      const bestBid = book.bids?.[0];
      const bestAsk = book.asks?.[0];

      if (!bestBid || !bestAsk) {
        this.emptyStreak.set(conditionId, (this.emptyStreak.get(conditionId) ?? 0) + 1);
        return;
      }

      const bidPrice = parseFloat(bestBid.price);
      const askPrice = parseFloat(bestAsk.price);
      const bidSize  = parseFloat(bestBid.size);
      const askSize  = parseFloat(bestAsk.size);

      // Liquidity filter: require at least $5 on each side and spread < 30%
      // Markets below this have no real arbitrage opportunity
      const minLiquidityUsd = 5;
      const spreadPct = (askPrice - bidPrice) / ((bidPrice + askPrice) / 2);
      if (bidSize < minLiquidityUsd || askSize < minLiquidityUsd || spreadPct > 0.30) {
        this.emptyStreak.set(conditionId, (this.emptyStreak.get(conditionId) ?? 0) + 1);
        return;
      }

      // Reset dead streak — market has real liquidity
      this.emptyStreak.set(conditionId, 0);

      this.orderbooks.set(conditionId, {
        marketSlug: market?.slug ?? conditionId,
        conditionId,
        bidPrice,
        askPrice,
        midPrice: (bidPrice + askPrice) / 2,
        spread: askPrice - bidPrice,
        bidSize,
        askSize,
        lastTradePrice: (bidPrice + askPrice) / 2,
        timestamp: Date.now(),
      });

      this.onOrderbookUpdate?.(conditionId, bidSize, askSize, bidPrice, askPrice);
    } catch {
      // silent — network errors don't stop the loop
    }
  }
}
