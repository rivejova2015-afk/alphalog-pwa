/**
 * Deribit derivatives signal feed (BTC + ETH).
 *
 * Subscribes to public WebSocket channel `ticker.{INSTRUMENT}.100ms` for
 * BTC-PERPETUAL and ETH-PERPETUAL. Each ticker payload exposes:
 *   - mark_price, index_price → basis = mark - index
 *   - current_funding (8h projected)
 *   - mark_iv (ATM forward implied volatility, percent)
 *
 * v1 directional logic uses basis + funding only. The `riskReversal25d` field
 * is populated from a basis-derived proxy (basis_bps * sign of funding) so the
 * downstream ConfluenceEngine has a non-zero number to work with. A future
 * follow-up will replace this with a proper 25-delta call IV minus 25-delta
 * put IV computed from the options book.
 *
 * Direction logic (per-symbol):
 *   UP   : basis_bps > 0 AND fundingBps > 0
 *   DOWN : basis_bps < 0 AND fundingBps < 0
 *   NEUTRAL otherwise
 *
 * Fail-closed: if no message in last 30_000ms → isStale=true → ConfluenceEngine SKIPS.
 * (30s threshold because Deribit perp tickers can pulse less often than Binance.)
 *
 * SOL is NOT available on Deribit — `getSignal('SOL')` falls back to BTC.
 */

import WebSocket from 'ws';

export type IVDirection = 'UP' | 'DOWN' | 'NEUTRAL';
export type IVSymbol = 'BTC' | 'ETH';

export interface IVSignal {
  symbol: IVSymbol;
  direction: IVDirection;
  confidence: number;       // 0..1
  riskReversal25d: number;  // bps proxy (basis-derived in v1; true 25Δ in future)
  ivAtm: number;            // percent (mark_iv from ticker payload)
  basisBps: number;         // (markPrice - indexPrice) / indexPrice * 10000
  fundingBps: number;       // 8h projected funding in bps
  ageMs: number;
  isStale: boolean;
}

const WS_URL = 'wss://www.deribit.com/ws/api/v2';
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const STALE_THRESHOLD_MS = 30_000;
// Phase 2: env-tunable dead zones + AND/OR logic. Lowering the floors and
// switching to disjunction lets IV vote UP/DOWN more often during quiet
// sessions instead of NEUTRAL, which is what feeds the LASTCHANCE/PANIC
// tiers in the loop.
const MIN_BASIS_BPS_FOR_BIAS = parseFloat(process.env.POLYARB_IV_MIN_BASIS_BPS ?? '1');
const MIN_FUNDING_BPS_FOR_BIAS = parseFloat(process.env.POLYARB_IV_MIN_FUNDING_BPS ?? '1');
const IV_DIRECTION_LOGIC = (process.env.POLYARB_IV_LOGIC ?? 'conjunction').toLowerCase();

const INSTRUMENTS: Record<IVSymbol, string> = {
  BTC: 'BTC-PERPETUAL',
  ETH: 'ETH-PERPETUAL',
};

const CHANNELS = Object.values(INSTRUMENTS).map(i => `ticker.${i}.100ms`);

interface DerivState {
  markPrice: number;
  indexPrice: number;
  fundingRate: number;     // raw rate (e.g. 0.0001 = 1bps)
  markIv: number;          // percent
  lastUpdate: number;
}

interface DeribitTickerData {
  instrument_name?: string;
  mark_price?: number;
  index_price?: number;
  current_funding?: number;
  mark_iv?: number;
}

interface DeribitMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: {
    channel?: string;
    data?: DeribitTickerData;
  };
  result?: unknown;
  error?: { code: number; message: string };
}

export class DeribitIVFeed {
  private ws: WebSocket | null = null;
  private connected = false;
  private subscribed = false;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRun = true;
  private nextRequestId = 1;

  private state: Map<IVSymbol, DerivState> = new Map([
    ['BTC', this.emptyState()],
    ['ETH', this.emptyState()],
  ]);

  get isConnected(): boolean { return this.connected; }

  start(): void {
    this.shouldRun = true;
    this.connect();
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this.subscribed = false;
  }

  /**
   * Snapshot the current directional signal for a symbol.
   * For SOL (not on Deribit), falls back to BTC signal as a correlated proxy.
   */
  getSignal(symbolOrProxy: IVSymbol | 'SOL'): IVSignal | null {
    const symbol: IVSymbol = symbolOrProxy === 'SOL' ? 'BTC' : symbolOrProxy;
    const s = this.state.get(symbol);
    if (!s || s.markPrice <= 0 || s.lastUpdate === 0) return null;

    const now = Date.now();
    const ageMs = now - s.lastUpdate;
    const isStale = ageMs > STALE_THRESHOLD_MS;

    const basisBps = s.indexPrice > 0
      ? ((s.markPrice - s.indexPrice) / s.indexPrice) * 10_000
      : 0;
    const fundingBps = s.fundingRate * 10_000;

    const basisUp = basisBps >= MIN_BASIS_BPS_FOR_BIAS;
    const basisDown = basisBps <= -MIN_BASIS_BPS_FOR_BIAS;
    const fundingUp = fundingBps >= MIN_FUNDING_BPS_FOR_BIAS;
    const fundingDown = fundingBps <= -MIN_FUNDING_BPS_FOR_BIAS;

    let direction: IVDirection = 'NEUTRAL';
    let confidence = 0;
    const useDisjunction = IV_DIRECTION_LOGIC === 'disjunction';
    const upPasses = useDisjunction ? (basisUp || fundingUp) : (basisUp && fundingUp);
    const downPasses = useDisjunction ? (basisDown || fundingDown) : (basisDown && fundingDown);
    // In disjunction mode, prevent contradictory votes (e.g. basisUp && fundingDown)
    // from being labeled as either direction — fall back to NEUTRAL.
    const upConflict = useDisjunction && upPasses && (basisDown || fundingDown);
    const downConflict = useDisjunction && downPasses && (basisUp || fundingUp);
    if (upPasses && !upConflict) {
      direction = 'UP';
      confidence = this.scoreConfidence(basisBps, fundingBps);
    } else if (downPasses && !downConflict) {
      direction = 'DOWN';
      confidence = this.scoreConfidence(-basisBps, -fundingBps);
    }

    // Risk reversal proxy: same sign as basisBps, magnitude scaled to look like bps.
    const riskReversal25d = direction === 'NEUTRAL'
      ? 0
      : (direction === 'UP' ? Math.abs(basisBps) : -Math.abs(basisBps));

    return {
      symbol,
      direction,
      confidence,
      riskReversal25d,
      ivAtm: s.markIv,
      basisBps,
      fundingBps,
      ageMs,
      isStale,
    };
  }

  private connect(): void {
    if (!this.shouldRun) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[deribit-iv-ws] Connected (BTC+ETH perpetual tickers)');
        this.connected = true;
        this.reconnectDelay = RECONNECT_DELAY_MS;
        this.subscribe();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as DeribitMessage;

          if (msg.error) {
            console.warn(`[deribit-iv-ws] RPC error: ${msg.error.code} ${msg.error.message}`);
            return;
          }

          if (msg.method === 'subscription' && msg.params?.channel && msg.params.data) {
            this.handleTickerUpdate(msg.params.channel, msg.params.data);
          }
        } catch {
          // Skip malformed messages
        }
      });

      this.ws.on('close', () => {
        console.log('[deribit-iv-ws] Disconnected');
        this.connected = false;
        this.subscribed = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('[deribit-iv-ws] Error:', err.message);
        this.connected = false;
      });
    } catch (err) {
      console.error('[deribit-iv-ws] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.subscribed) return;
    const payload = {
      jsonrpc: '2.0',
      id: this.nextRequestId++,
      method: 'public/subscribe',
      params: { channels: CHANNELS },
    };
    this.ws.send(JSON.stringify(payload));
    this.subscribed = true;
    console.log(`[deribit-iv-ws] Subscribed to ${CHANNELS.join(', ')}`);
  }

  private handleTickerUpdate(channel: string, data: DeribitTickerData): void {
    const instrument = data.instrument_name ?? channel.replace(/^ticker\./, '').replace(/\.100ms$/, '');
    let symbol: IVSymbol | null = null;
    if (instrument === INSTRUMENTS.BTC) symbol = 'BTC';
    else if (instrument === INSTRUMENTS.ETH) symbol = 'ETH';
    if (!symbol) return;

    const s = this.state.get(symbol);
    if (!s) return;

    const now = Date.now();
    if (typeof data.mark_price === 'number' && data.mark_price > 0) s.markPrice = data.mark_price;
    if (typeof data.index_price === 'number' && data.index_price > 0) s.indexPrice = data.index_price;
    if (typeof data.current_funding === 'number' && Number.isFinite(data.current_funding)) {
      s.fundingRate = data.current_funding;
    }
    if (typeof data.mark_iv === 'number' && Number.isFinite(data.mark_iv)) {
      s.markIv = data.mark_iv;
    }
    s.lastUpdate = now;
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    console.log(`[deribit-iv-ws] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  private scoreConfidence(basisBps: number, fundingBps: number): number {
    const basisScore = Math.min(1, Math.abs(basisBps) / 5);     // 5bps → full
    const fundingScore = Math.min(1, Math.abs(fundingBps) / 5); // 5bps → full
    return Math.min(1, basisScore * 0.5 + fundingScore * 0.5);
  }

  private emptyState(): DerivState {
    return { markPrice: 0, indexPrice: 0, fundingRate: 0, markIv: 0, lastUpdate: 0 };
  }
}
