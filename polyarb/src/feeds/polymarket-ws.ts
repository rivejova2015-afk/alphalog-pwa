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
  negRisk: boolean;
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
    // POLYARB_MARKET_SLUG_PREFIX controls which event slugs to track.
    // Default: "btc-updown-5m-" — only 5-minute BTC Up/Down markets.
    // btc-updown-5m markets are events in the gamma events API, not the markets API.
    const slugPrefix = process.env.POLYARB_MARKET_SLUG_PREFIX ?? 'btc-updown-5m-';

    try {
      const res = await fetch(
        `${GAMMA_BASE}/events?active=true&closed=false&limit=500&tag_slug=bitcoin`,
        { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(15_000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json() as Array<{
        slug?: string;
        title?: string;
        endDate?: string;
        active?: boolean;
        closed?: boolean;
        markets?: Array<{
          slug?: string;
          conditionId?: string;
          clobTokenIds?: string;
          active?: boolean;
          closed?: boolean;
          negRisk?: boolean;
        }>;
      }>;

      const data = Array.isArray(raw) ? raw : [];
      const now = Date.now();
      const cryptoMarkets: PolymarketMarket[] = [];

      for (const event of data) {
        const eventSlug = event.slug ?? '';
        if (!eventSlug.startsWith(slugPrefix)) continue;
        if (event.closed) continue;
        if (!event.markets || event.markets.length === 0) continue;

        // For btc-updown-5m-<timestamp> slugs, use the slug timestamp as expiry.
        // gamma API's event.endDate is the series end (far future), not the window close.
        const slugTs = parseInt(eventSlug.split('-').pop() ?? '0', 10);
        const endMs  = slugTs > 0 ? slugTs * 1000 : new Date(event.endDate ?? 0).getTime();
        if (endMs <= now + 60_000) continue; // skip if expires in <60s or already past

        const m = event.markets[0];
        if (!m?.conditionId) continue;

        let tokenIds: string[] = [];
        try {
          tokenIds = typeof m.clobTokenIds === 'string'
            ? JSON.parse(m.clobTokenIds) as string[]
            : (m.clobTokenIds as unknown as string[] ?? []);
        } catch { continue; }

        if (tokenIds.length < 2) continue;

        cryptoMarkets.push({
          slug:        eventSlug,
          conditionId: m.conditionId,
          question:    event.title ?? eventSlug,
          endDate:     event.endDate ?? '',
          active:      event.active ?? true,
          yesTokenId:  tokenIds[0],  // "Up" outcome
          noTokenId:   tokenIds[1],  // "Down" outcome
          negRisk:     m.negRisk === true,  // read from gamma API (NOT always negRisk)
        });
      }

      // Sort by slug timestamp (= actual window close), soonest first.
      const slugTs = (slug: string) => parseInt(slug.split('-').pop() ?? '0', 10) * 1000;
      cryptoMarkets.sort((a, b) => slugTs(a.slug) - slugTs(b.slug));

      // Cap at 20 — 5min markets refresh constantly, no need for large batch
      const selected = cryptoMarkets.slice(0, 20);

      for (const market of selected) {
        this.markets.set(market.conditionId, market);
        this.emptyStreak.delete(market.conditionId);
      }

      console.log(`[polymarket-ws] Found ${cryptoMarkets.length} ${slugPrefix} markets → tracking ${selected.length}`);
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

      // Polymarket CLOB /book returns bids sorted ASCENDING (worst=lowest first)
      // and asks sorted DESCENDING (worst=highest first). Sort to get true best.
      const sortedBids = (book.bids ?? []).sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      const sortedAsks = (book.asks ?? []).sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      const bestBid = sortedBids[0];
      const bestAsk = sortedAsks[0];

      if (!bestBid || !bestAsk) {
        this.emptyStreak.set(conditionId, (this.emptyStreak.get(conditionId) ?? 0) + 1);
        return;
      }

      const bidPrice = parseFloat(bestBid.price);
      const askPrice = parseFloat(bestAsk.price);
      const bidSize  = parseFloat(bestBid.size);
      const askSize  = parseFloat(bestAsk.size);

      // Liquidity filter: min 1 share each side and spread < 30%
      const minSizeShares = 1;
      const spreadPct = (askPrice - bidPrice) / ((bidPrice + askPrice) / 2);
      if (bidSize < minSizeShares || askSize < minSizeShares || spreadPct > 0.30) {
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
