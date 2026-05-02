/**
 * Binance Perpetual Futures multi-asset directional signal feed.
 *
 * Sources for directional bias on BTC/ETH/SOL perps:
 *   - markPrice stream (1s) → 60s rolling average for trend
 *   - aggTrade stream     → buy/sell volume imbalance proxy for OI delta
 *   - markPrice payload includes fundingRate (current 8h funding)
 *
 * Direction logic (per-symbol):
 *   UP   : fundingRateBps > 0 AND oiDeltaPct1m > +0.10% AND markPrice > avgMark1m
 *   DOWN : fundingRateBps < 0 AND oiDeltaPct1m < -0.10% AND markPrice < avgMark1m
 *   NEUTRAL otherwise
 *
 * Fail-closed: if no message in last 5_000ms → isStale=true → ConfluenceEngine SKIPS.
 */

import WebSocket from 'ws';

export type PerpDirection = 'UP' | 'DOWN' | 'NEUTRAL';
export type PerpSymbol = 'BTC' | 'ETH' | 'SOL';

export interface PerpSignal {
  symbol: PerpSymbol;
  direction: PerpDirection;
  confidence: number;       // 0..1 (composite of funding, OI delta, mark trend)
  fundingRateBps: number;   // current 8h funding rate in basis points
  oiDeltaPct1m: number;     // proxy: 1m signed buy-volume / total-volume * 100
  markPrice: number;
  ageMs: number;            // ms since last message
  isStale: boolean;         // true if ageMs > STALE_THRESHOLD_MS
}

interface MarkSample {
  price: number;
  timestamp: number;
}

interface TradeSample {
  qty: number;
  isBuyerMaker: boolean;    // true = sell aggressor, false = buy aggressor
  timestamp: number;
}

const WS_URL =
  'wss://fstream.binance.com/stream?streams=' +
  'btcusdt@markPrice@1s/ethusdt@markPrice@1s/solusdt@markPrice@1s/' +
  'btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade';

const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MARK_HISTORY_MS = 60_000;       // 60s of mark prices for trend avg
const TRADE_HISTORY_MS = 60_000;      // 60s of aggTrades for OI delta proxy
const STALE_THRESHOLD_MS = 5_000;     // signal is stale if no msg in 5s
const MIN_OI_DELTA_PCT = 0.10;        // direction threshold
const MIN_FUNDING_BPS_FOR_BIAS = 1;   // funding magnitude to count as biased

const STREAM_TO_SYMBOL: Record<string, PerpSymbol> = {
  btcusdt: 'BTC',
  ethusdt: 'ETH',
  solusdt: 'SOL',
};

interface PerpState {
  marks: MarkSample[];
  trades: TradeSample[];
  lastMark: number;
  lastFundingRate: number;     // raw rate (e.g. 0.0001 = 1bps)
  lastUpdate: number;
}

export class BinancePerpFeed {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private diagnosticTimer: ReturnType<typeof setInterval> | null = null;
  private shouldRun = true;

  // Diagnostics — tracks whether Binance is actually delivering data after handshake.
  // Cloud IPs (Fly.io, AWS, etc.) sometimes complete the WS handshake to fstream.binance.com
  // but never receive frames, due to silent geo/IP blocking.
  private msgsReceived = 0;
  private parseErrors = 0;
  private firstMessageLogged = false;

  private state: Map<PerpSymbol, PerpState> = new Map([
    ['BTC', this.emptyState()],
    ['ETH', this.emptyState()],
    ['SOL', this.emptyState()],
  ]);

  get isConnected(): boolean { return this.connected; }

  start(): void {
    this.shouldRun = true;
    this.connect();
    // Periodic diagnostic dump so we can detect silent data starvation in production.
    if (!this.diagnosticTimer) {
      this.diagnosticTimer = setInterval(() => this.logDiagnostics(), 30_000);
    }
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.diagnosticTimer) { clearInterval(this.diagnosticTimer); this.diagnosticTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
  }

  private logDiagnostics(): void {
    const btc = this.state.get('BTC')!;
    const eth = this.state.get('ETH')!;
    const sol = this.state.get('SOL')!;
    console.log(
      `[binance-perp-ws] diag connected=${this.connected} msgs=${this.msgsReceived} parseErrs=${this.parseErrors} ` +
      `BTC.mark=${btc.lastMark} ETH.mark=${eth.lastMark} SOL.mark=${sol.lastMark} ` +
      `BTC.trades=${btc.trades.length} ETH.trades=${eth.trades.length} SOL.trades=${sol.trades.length}`
    );
  }

  /**
   * Snapshot the current directional signal for a symbol.
   * Returns null if no data yet (cold start). Sets isStale=true if data is older than 5s.
   */
  getSignal(symbol: PerpSymbol): PerpSignal | null {
    const s = this.state.get(symbol);
    if (!s || s.lastMark <= 0 || s.lastUpdate === 0) return null;

    const now = Date.now();
    const ageMs = now - s.lastUpdate;
    const isStale = ageMs > STALE_THRESHOLD_MS;

    const fundingRateBps = s.lastFundingRate * 10_000;
    const avgMark1m = this.computeAvgMark(s, now);
    const oiDeltaPct1m = this.computeOiDeltaPct(s, now);

    const fundingUp = fundingRateBps >= MIN_FUNDING_BPS_FOR_BIAS;
    const fundingDown = fundingRateBps <= -MIN_FUNDING_BPS_FOR_BIAS;
    const oiUp = oiDeltaPct1m >= MIN_OI_DELTA_PCT;
    const oiDown = oiDeltaPct1m <= -MIN_OI_DELTA_PCT;
    const markUp = avgMark1m > 0 && s.lastMark > avgMark1m;
    const markDown = avgMark1m > 0 && s.lastMark < avgMark1m;

    let direction: PerpDirection = 'NEUTRAL';
    let confidence = 0;

    if (fundingUp && oiUp && markUp) {
      direction = 'UP';
      confidence = this.scoreConfidence(fundingRateBps, oiDeltaPct1m, s.lastMark, avgMark1m);
    } else if (fundingDown && oiDown && markDown) {
      direction = 'DOWN';
      confidence = this.scoreConfidence(-fundingRateBps, -oiDeltaPct1m, avgMark1m, s.lastMark);
    }

    return {
      symbol,
      direction,
      confidence,
      fundingRateBps,
      oiDeltaPct1m,
      markPrice: s.lastMark,
      ageMs,
      isStale,
    };
  }

  private connect(): void {
    if (!this.shouldRun) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[binance-perp-ws] Connected (BTC+ETH+SOL perps combined stream)');
        this.connected = true;
        this.reconnectDelay = RECONNECT_DELAY_MS;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.msgsReceived++;
        if (!this.firstMessageLogged) {
          this.firstMessageLogged = true;
          const preview = data.toString().slice(0, 200);
          console.log(`[binance-perp-ws] first message received: ${preview}`);
        }
        try {
          const envelope = JSON.parse(data.toString()) as {
            stream?: string;
            data?: Record<string, unknown>;
          };
          if (!envelope.stream || !envelope.data) return;

          const [streamBase, streamKind] = envelope.stream.split('@');
          const symbol = STREAM_TO_SYMBOL[streamBase];
          if (!symbol) return;

          const s = this.state.get(symbol);
          if (!s) return;

          const ts = Date.now();
          s.lastUpdate = ts;

          if (streamKind === 'markPrice') {
            const payload = envelope.data as { p?: string; r?: string };
            const mark = parseFloat(payload.p ?? '0');
            const funding = parseFloat(payload.r ?? '0');
            if (mark > 0) {
              s.lastMark = mark;
              s.marks.push({ price: mark, timestamp: ts });
              this.pruneMarks(s, ts);
            }
            if (Number.isFinite(funding)) s.lastFundingRate = funding;
          } else if (streamKind === 'aggTrade') {
            const payload = envelope.data as { q?: string; m?: boolean };
            const qty = parseFloat(payload.q ?? '0');
            if (qty > 0 && typeof payload.m === 'boolean') {
              s.trades.push({ qty, isBuyerMaker: payload.m, timestamp: ts });
              this.pruneTrades(s, ts);
            }
          }
        } catch (err) {
          this.parseErrors++;
          if (this.parseErrors <= 3) {
            console.warn(`[binance-perp-ws] parse error #${this.parseErrors}:`, (err as Error).message);
          }
        }
      });

      this.ws.on('close', () => {
        console.log('[binance-perp-ws] Disconnected');
        this.connected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('[binance-perp-ws] Error:', err.message);
        this.connected = false;
      });
    } catch (err) {
      console.error('[binance-perp-ws] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    console.log(`[binance-perp-ws] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  private pruneMarks(s: PerpState, now: number): void {
    const cutoff = now - MARK_HISTORY_MS;
    while (s.marks.length > 0 && s.marks[0].timestamp < cutoff) s.marks.shift();
  }

  private pruneTrades(s: PerpState, now: number): void {
    const cutoff = now - TRADE_HISTORY_MS;
    while (s.trades.length > 0 && s.trades[0].timestamp < cutoff) s.trades.shift();
  }

  private computeAvgMark(s: PerpState, now: number): number {
    this.pruneMarks(s, now);
    if (s.marks.length === 0) return 0;
    let sum = 0;
    for (const m of s.marks) sum += m.price;
    return sum / s.marks.length;
  }

  /**
   * OI delta proxy: sum(buy qty) - sum(sell qty) over last 60s, normalized by total qty.
   * Buy aggressor = isBuyerMaker:false (taker hit ask). Sell aggressor = isBuyerMaker:true.
   * Returns signed percentage in -100..+100.
   */
  private computeOiDeltaPct(s: PerpState, now: number): number {
    this.pruneTrades(s, now);
    if (s.trades.length === 0) return 0;
    let buyQty = 0;
    let sellQty = 0;
    for (const t of s.trades) {
      if (t.isBuyerMaker) sellQty += t.qty;
      else buyQty += t.qty;
    }
    const total = buyQty + sellQty;
    if (total <= 0) return 0;
    return ((buyQty - sellQty) / total) * 100;
  }

  /**
   * Composite confidence 0..1 weighting funding magnitude, OI delta magnitude,
   * and mark trend strength. Capped at 1.
   */
  private scoreConfidence(
    fundingBps: number,
    oiDeltaPct: number,
    markCurrent: number,
    markBase: number,
  ): number {
    const fundingScore = Math.min(1, Math.abs(fundingBps) / 5);     // 5bps funding → full score
    const oiScore = Math.min(1, Math.abs(oiDeltaPct) / 5);          // 5% OI imbalance → full score
    const trendScore = markBase > 0
      ? Math.min(1, Math.abs(markCurrent - markBase) / markBase * 200)  // 0.5% mark drift → full score
      : 0;
    return Math.min(1, (fundingScore * 0.3 + oiScore * 0.4 + trendScore * 0.3));
  }

  private emptyState(): PerpState {
    return { marks: [], trades: [], lastMark: 0, lastFundingRate: 0, lastUpdate: 0 };
  }
}
