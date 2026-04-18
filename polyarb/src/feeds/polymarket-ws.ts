/**
 * Polymarket CLOB WebSocket + REST feed.
 *
 * Connects to Polymarket's CLOB API for orderbook data.
 * REST polling as fallback when WebSocket is unavailable.
 *
 * CLOB API docs: https://docs.polymarket.com/
 */

export interface PolymarketOrderbook {
  marketSlug: string;
  conditionId: string;
  bidPrice: number;       // Best bid for YES
  askPrice: number;       // Best ask for YES
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
  yesTokenId: string;   // ERC1155 token ID for YES outcome
  noTokenId: string;    // ERC1155 token ID for NO outcome
}

import { clobFetch } from '../lib/clob-fetch.js';

const CLOB_REST_BASE = 'https://clob.polymarket.com';
const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const POLL_INTERVAL_MS = 2_000; // Poll every 2s via REST

export class PolymarketFeed {
  private markets: Map<string, PolymarketMarket> = new Map();
  private orderbooks: Map<string, PolymarketOrderbook> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private shouldRun = false;
  private trackedConditionIds: string[] = [];
  private polling = false; // lock to prevent overlapping polls

  /**
   * Sentiment Pulse callback — called every time a new orderbook is fetched.
   * Set this from the outside to hook in SentimentPulseTracker.record().
   */
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

  /**
   * Get all tracked markets (includes question text for milestone parsing).
   */
  getMarkets(): PolymarketMarket[] {
    return Array.from(this.markets.values());
  }

  /**
   * Get the latest orderbook for a condition.
   */
  getOrderbook(conditionId: string): PolymarketOrderbook | null {
    return this.orderbooks.get(conditionId) ?? null;
  }

  /**
   * Get all tracked orderbooks.
   */
  getAllOrderbooks(): PolymarketOrderbook[] {
    return Array.from(this.orderbooks.values());
  }

  /**
   * Start tracking specific markets by condition ID.
   */
  start(conditionIds: string[]): void {
    this.trackedConditionIds = conditionIds;
    this.shouldRun = true;
    console.log(`[polymarket-ws] Starting REST poll for ${conditionIds.length} markets`);

    // Initial fetch
    void this.pollOrderbooks();

    // Poll on interval
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

  /**
   * Fetch active crypto markets from Polymarket via gamma API.
   * Finds any open binary market with crypto price relevance.
   */
  async fetchCryptoMarkets(): Promise<PolymarketMarket[]> {
    try {
      // Gamma API returns currently active, open markets with real token IDs.
      // CLOB /markets only returns historical markets (mostly closed 2022-2023).
      const res = await fetch(
        `${GAMMA_BASE}/markets?active=true&closed=false&limit=500`,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8_000),
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json() as Array<{
        conditionId?: string;
        question?: string;
        endDate?: string;
        active?: boolean;
        slug?: string;
        outcomes?: string[];
        outcomePrices?: string[];
        /** JSON-encoded array: [yesTokenId, noTokenId] */
        clobTokenIds?: string;
      }>;

      const data = Array.isArray(raw) ? raw : [];

      const cryptoMarkets: PolymarketMarket[] = [];
      for (const m of data) {
        const q = (m.question ?? '').toLowerCase();

        // Crypto price / crypto-adjacent filter — broader than the old CLOB approach
        const isCrypto =
          q.includes('btc') || q.includes('bitcoin') ||
          q.includes('eth') || q.includes('ethereum') ||
          q.includes('sol') || q.includes('solana') ||
          q.includes('crypto') || q.includes('coinbase') ||
          q.includes('binance') || q.includes('doge') ||
          q.includes('xrp') || q.includes('ripple') ||
          q.includes('$1m') || q.includes('$1,000,000');

        if (!isCrypto) continue;

        // gamma API encodes outcomes and clobTokenIds as JSON strings, not arrays
        let outcomes: string[] = [];
        let tokenIds: string[] = [];
        try {
          outcomes = typeof m.outcomes === 'string'
            ? JSON.parse(m.outcomes) as string[]
            : (m.outcomes ?? []);
          tokenIds = typeof m.clobTokenIds === 'string'
            ? JSON.parse(m.clobTokenIds) as string[]
            : [];
        } catch {
          continue;
        }

        // Binary markets only (exactly 2 outcomes: Yes/No)
        if (outcomes.length !== 2) continue;

        const yesIdx = outcomes.findIndex(o => o.toLowerCase() === 'yes');
        const noIdx  = outcomes.findIndex(o => o.toLowerCase() === 'no');
        const yesTokenId = tokenIds[yesIdx >= 0 ? yesIdx : 0] ?? '';
        const noTokenId  = tokenIds[noIdx  >= 0 ? noIdx  : 1] ?? '';

        if (!yesTokenId || !m.conditionId) continue;

        cryptoMarkets.push({
          slug:        m.slug ?? '',
          conditionId: m.conditionId,
          question:    m.question ?? '',
          endDate:     m.endDate ?? '',
          active:      m.active ?? true,
          yesTokenId,
          noTokenId,
        });
      }

      // Cache locally
      for (const market of cryptoMarkets) {
        this.markets.set(market.conditionId, market);
      }

      console.log(`[polymarket-ws] Found ${cryptoMarkets.length} active crypto markets via gamma API`);
      return cryptoMarkets;
    } catch (err) {
      console.error('[polymarket-ws] Market fetch error:', err);
      return [];
    }
  }

  /**
   * Poll orderbooks for all tracked conditions in parallel.
   */
  private async pollOrderbooks(): Promise<void> {
    if (this.polling) return; // skip if previous poll still running
    this.polling = true;
    try {
      await Promise.allSettled(
        this.trackedConditionIds.map(conditionId => this.fetchOneOrderbook(conditionId))
      );
    } finally {
      this.polling = false;
    }
  }

  private async fetchOneOrderbook(conditionId: string): Promise<void> {
    try {
      const market = this.markets.get(conditionId);
      const tokenId = market?.yesTokenId || conditionId;

      const res = await clobFetch(
        `${CLOB_REST_BASE}/book?token_id=${tokenId}`,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(4_000),
        }
      );

      if (!res.ok) return;
      const book = await res.json() as {
        bids?: Array<{ price: string; size: string }>;
        asks?: Array<{ price: string; size: string }>;
      };

      const bestBid = book.bids?.[0];
      const bestAsk = book.asks?.[0];
      if (!bestBid || !bestAsk) return;

      const bidPrice = parseFloat(bestBid.price);
      const askPrice = parseFloat(bestAsk.price);
      const midPrice = (bidPrice + askPrice) / 2;
      const bidSize = parseFloat(bestBid.size);
      const askSize = parseFloat(bestAsk.size);

      this.orderbooks.set(conditionId, {
        marketSlug: market?.slug ?? conditionId,
        conditionId,
        bidPrice,
        askPrice,
        midPrice,
        spread: askPrice - bidPrice,
        bidSize,
        askSize,
        lastTradePrice: midPrice,
        timestamp: Date.now(),
      });

      this.onOrderbookUpdate?.(conditionId, bidSize, askSize, bidPrice, askPrice);
    } catch {
      // skip failed fetches silently
    }
  }
}
