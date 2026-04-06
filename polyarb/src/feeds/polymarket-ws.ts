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
}

const CLOB_REST_BASE = 'https://clob.polymarket.com';
const POLL_INTERVAL_MS = 1_000; // Poll every 1s via REST

export class PolymarketFeed {
  private markets: Map<string, PolymarketMarket> = new Map();
  private orderbooks: Map<string, PolymarketOrderbook> = new Map();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private shouldRun = false;
  private trackedConditionIds: string[] = [];

  get isConnected(): boolean {
    return this.shouldRun && this.orderbooks.size > 0;
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
   * Fetch active crypto markets from Polymarket.
   * Filter for BTC milestone markets (e.g., "BTC above $X").
   */
  async fetchCryptoMarkets(): Promise<PolymarketMarket[]> {
    try {
      const res = await fetch(`${CLOB_REST_BASE}/markets`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Array<{
        condition_id?: string;
        question?: string;
        end_date_iso?: string;
        active?: boolean;
        market_slug?: string;
      }>;

      const cryptoMarkets: PolymarketMarket[] = [];
      for (const m of data) {
        const q = (m.question ?? '').toLowerCase();
        // Filter for crypto price milestone markets
        if (
          (q.includes('btc') || q.includes('bitcoin') ||
           q.includes('eth') || q.includes('ethereum') ||
           q.includes('sol') || q.includes('solana')) &&
          (q.includes('above') || q.includes('below') || q.includes('reach'))
        ) {
          cryptoMarkets.push({
            slug: m.market_slug ?? '',
            conditionId: m.condition_id ?? '',
            question: m.question ?? '',
            endDate: m.end_date_iso ?? '',
            active: m.active ?? false,
          });
        }
      }

      // Cache locally
      for (const market of cryptoMarkets) {
        this.markets.set(market.conditionId, market);
      }

      return cryptoMarkets;
    } catch (err) {
      console.error('[polymarket-ws] Market fetch error:', err);
      return [];
    }
  }

  /**
   * Poll orderbooks for tracked conditions via REST.
   */
  private async pollOrderbooks(): Promise<void> {
    for (const conditionId of this.trackedConditionIds) {
      try {
        const res = await fetch(
          `${CLOB_REST_BASE}/book?token_id=${conditionId}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5_000),
          }
        );

        if (!res.ok) continue;
        const book = await res.json() as {
          bids?: Array<{ price: string; size: string }>;
          asks?: Array<{ price: string; size: string }>;
        };

        const bestBid = book.bids?.[0];
        const bestAsk = book.asks?.[0];
        if (!bestBid || !bestAsk) continue;

        const bidPrice = parseFloat(bestBid.price);
        const askPrice = parseFloat(bestAsk.price);
        const midPrice = (bidPrice + askPrice) / 2;

        this.orderbooks.set(conditionId, {
          marketSlug: this.markets.get(conditionId)?.slug ?? conditionId,
          conditionId,
          bidPrice,
          askPrice,
          midPrice,
          spread: askPrice - bidPrice,
          bidSize: parseFloat(bestBid.size),
          askSize: parseFloat(bestAsk.size),
          lastTradePrice: midPrice, // approximation
          timestamp: Date.now(),
        });
      } catch {
        // Skip failed fetches
      }
    }
  }
}
