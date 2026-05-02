/**
 * Binance Perpetual Futures multi-asset directional signal feed.
 *
 * Uses REST polling against fapi.binance.com instead of the public WebSocket.
 * fstream.binance.com silently drops frames for many cloud IP ranges
 * (Fly.io Singapore among them) — handshake completes, then no data ever
 * arrives. fapi.binance.com REST is unaffected from the same IPs, so we
 * poll it at a cadence that matches our 5-minute trading horizon.
 *
 * Endpoints (no auth required):
 *   GET /fapi/v1/premiumIndex?symbol=BTCUSDT  →  markPrice + lastFundingRate
 *   GET /fapi/v1/openInterest?symbol=BTCUSDT  →  current OI in contracts
 *
 * Polling cadence:
 *   - premiumIndex: every 2s per symbol (3 symbols × 30 = 90 weight/min, well under 2400 limit)
 *   - openInterest: every 5s per symbol (used for the 60s OI-delta proxy)
 *
 * Direction logic (per-symbol, unchanged from prior WS impl):
 *   UP   : fundingRateBps > 0 AND oiDeltaPct1m > +0.10% AND markPrice > avgMark1m
 *   DOWN : fundingRateBps < 0 AND oiDeltaPct1m < -0.10% AND markPrice < avgMark1m
 *   NEUTRAL otherwise
 *
 * Fail-closed: STALE_THRESHOLD_MS=15s. ConfluenceEngine SKIPS when stale.
 *
 * The class name and exported API are preserved (BinancePerpFeed, start/stop/
 * getSignal/isConnected) so callers in loop-50x.ts and the confluence engine
 * keep working without changes.
 */

export type PerpDirection = 'UP' | 'DOWN' | 'NEUTRAL';
export type PerpSymbol = 'BTC' | 'ETH' | 'SOL';

export interface PerpSignal {
  symbol: PerpSymbol;
  direction: PerpDirection;
  confidence: number;
  fundingRateBps: number;
  oiDeltaPct1m: number;
  markPrice: number;
  ageMs: number;
  isStale: boolean;
}

interface MarkSample {
  price: number;
  timestamp: number;
}

interface OiSample {
  oi: number;
  timestamp: number;
}

const FAPI_BASE = 'https://fapi.binance.com';
const PREMIUM_POLL_MS = 2_000;
const OI_POLL_MS = 5_000;
const HTTP_TIMEOUT_MS = 8_000;
const MARK_HISTORY_MS = 60_000;
const OI_HISTORY_MS = 90_000;          // keep slightly more than 60s so we can pick the closest sample to t-60s
const STALE_THRESHOLD_MS = 15_000;
const MIN_OI_DELTA_PCT = 0.10;
const MIN_FUNDING_BPS_FOR_BIAS = 1;

const SYMBOL_TO_FAPI: Record<PerpSymbol, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
};

interface PerpState {
  marks: MarkSample[];
  ois: OiSample[];
  lastMark: number;
  lastFundingRate: number;
  lastUpdate: number;
}

export class BinancePerpFeed {
  private premiumTimer: ReturnType<typeof setInterval> | null = null;
  private oiTimer: ReturnType<typeof setInterval> | null = null;
  private diagnosticTimer: ReturnType<typeof setInterval> | null = null;
  private shouldRun = true;

  private premiumOk = 0;
  private premiumErr = 0;
  private oiOk = 0;
  private oiErr = 0;
  private firstSampleLogged = false;

  private state: Map<PerpSymbol, PerpState> = new Map([
    ['BTC', this.emptyState()],
    ['ETH', this.emptyState()],
    ['SOL', this.emptyState()],
  ]);

  // We're "connected" once at least one premiumIndex call has succeeded for any symbol.
  // Lets the confluence engine treat REST polling like the WS used to be treated.
  get isConnected(): boolean { return this.premiumOk > 0; }

  start(): void {
    this.shouldRun = true;
    console.log('[binance-perp-ws] Starting REST polling (fapi.binance.com premiumIndex+openInterest)');

    // Kick off one cycle immediately so the first signal appears within a second instead
    // of after the first PREMIUM_POLL_MS interval.
    void this.pollPremium();
    void this.pollOpenInterest();

    if (!this.premiumTimer) {
      this.premiumTimer = setInterval(() => { void this.pollPremium(); }, PREMIUM_POLL_MS);
    }
    if (!this.oiTimer) {
      this.oiTimer = setInterval(() => { void this.pollOpenInterest(); }, OI_POLL_MS);
    }
    if (!this.diagnosticTimer) {
      this.diagnosticTimer = setInterval(() => this.logDiagnostics(), 30_000);
    }
  }

  stop(): void {
    this.shouldRun = false;
    if (this.premiumTimer) { clearInterval(this.premiumTimer); this.premiumTimer = null; }
    if (this.oiTimer) { clearInterval(this.oiTimer); this.oiTimer = null; }
    if (this.diagnosticTimer) { clearInterval(this.diagnosticTimer); this.diagnosticTimer = null; }
  }

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

  private async pollPremium(): Promise<void> {
    if (!this.shouldRun) return;
    const symbols: PerpSymbol[] = ['BTC', 'ETH', 'SOL'];
    await Promise.allSettled(symbols.map((sym) => this.fetchPremiumOne(sym)));
  }

  private async fetchPremiumOne(symbol: PerpSymbol): Promise<void> {
    const url = `${FAPI_BASE}/fapi/v1/premiumIndex?symbol=${SYMBOL_TO_FAPI[symbol]}`;
    try {
      const json = await fetchJson<{ markPrice?: string; lastFundingRate?: string }>(url);
      const mark = parseFloat(json.markPrice ?? '0');
      const funding = parseFloat(json.lastFundingRate ?? '0');
      if (!(mark > 0)) return;

      const s = this.state.get(symbol);
      if (!s) return;

      const ts = Date.now();
      s.lastMark = mark;
      if (Number.isFinite(funding)) s.lastFundingRate = funding;
      s.lastUpdate = ts;
      s.marks.push({ price: mark, timestamp: ts });
      this.pruneMarks(s, ts);

      this.premiumOk++;
      if (!this.firstSampleLogged) {
        this.firstSampleLogged = true;
        console.log(
          `[binance-perp-ws] first sample ok symbol=${symbol} mark=${mark} funding=${funding}`,
        );
      }
    } catch (err) {
      this.premiumErr++;
      if (this.premiumErr <= 3) {
        console.warn(
          `[binance-perp-ws] premiumIndex error #${this.premiumErr} symbol=${symbol}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async pollOpenInterest(): Promise<void> {
    if (!this.shouldRun) return;
    const symbols: PerpSymbol[] = ['BTC', 'ETH', 'SOL'];
    await Promise.allSettled(symbols.map((sym) => this.fetchOiOne(sym)));
  }

  private async fetchOiOne(symbol: PerpSymbol): Promise<void> {
    const url = `${FAPI_BASE}/fapi/v1/openInterest?symbol=${SYMBOL_TO_FAPI[symbol]}`;
    try {
      const json = await fetchJson<{ openInterest?: string }>(url);
      const oi = parseFloat(json.openInterest ?? '0');
      if (!(oi > 0)) return;

      const s = this.state.get(symbol);
      if (!s) return;

      const ts = Date.now();
      s.ois.push({ oi, timestamp: ts });
      this.pruneOis(s, ts);
      this.oiOk++;
    } catch (err) {
      this.oiErr++;
      if (this.oiErr <= 3) {
        console.warn(
          `[binance-perp-ws] openInterest error #${this.oiErr} symbol=${symbol}: ${(err as Error).message}`,
        );
      }
    }
  }

  private logDiagnostics(): void {
    const btc = this.state.get('BTC')!;
    const eth = this.state.get('ETH')!;
    const sol = this.state.get('SOL')!;
    console.log(
      `[binance-perp-ws] diag premiumOk=${this.premiumOk} premiumErr=${this.premiumErr} oiOk=${this.oiOk} oiErr=${this.oiErr} ` +
      `BTC.mark=${btc.lastMark} ETH.mark=${eth.lastMark} SOL.mark=${sol.lastMark} ` +
      `BTC.ois=${btc.ois.length} ETH.ois=${eth.ois.length} SOL.ois=${sol.ois.length}`,
    );
  }

  private pruneMarks(s: PerpState, now: number): void {
    const cutoff = now - MARK_HISTORY_MS;
    while (s.marks.length > 0 && s.marks[0].timestamp < cutoff) s.marks.shift();
  }

  private pruneOis(s: PerpState, now: number): void {
    const cutoff = now - OI_HISTORY_MS;
    while (s.ois.length > 0 && s.ois[0].timestamp < cutoff) s.ois.shift();
  }

  private computeAvgMark(s: PerpState, now: number): number {
    this.pruneMarks(s, now);
    if (s.marks.length === 0) return 0;
    let sum = 0;
    for (const m of s.marks) sum += m.price;
    return sum / s.marks.length;
  }

  /**
   * OI delta % over the last ~60 seconds. Picks the OI sample closest to t-60s
   * as the baseline and compares to the most recent sample. Returns 0 if we
   * don't yet have at least two samples spanning ~60s.
   */
  private computeOiDeltaPct(s: PerpState, now: number): number {
    this.pruneOis(s, now);
    if (s.ois.length < 2) return 0;

    const target = now - 60_000;
    let baseline = s.ois[0];
    let bestGap = Math.abs(baseline.timestamp - target);
    for (const sample of s.ois) {
      const gap = Math.abs(sample.timestamp - target);
      if (gap < bestGap) { bestGap = gap; baseline = sample; }
    }
    const latest = s.ois[s.ois.length - 1];
    if (!(baseline.oi > 0)) return 0;
    if (Math.abs(latest.timestamp - baseline.timestamp) < 15_000) return 0;
    return ((latest.oi - baseline.oi) / baseline.oi) * 100;
  }

  private scoreConfidence(
    fundingBps: number,
    oiDeltaPct: number,
    markCurrent: number,
    markBase: number,
  ): number {
    const fundingScore = Math.min(1, Math.abs(fundingBps) / 5);
    const oiScore = Math.min(1, Math.abs(oiDeltaPct) / 5);
    const trendScore = markBase > 0
      ? Math.min(1, Math.abs(markCurrent - markBase) / markBase * 200)
      : 0;
    return Math.min(1, (fundingScore * 0.3 + oiScore * 0.4 + trendScore * 0.3));
  }

  private emptyState(): PerpState {
    return { marks: [], ois: [], lastMark: 0, lastFundingRate: 0, lastUpdate: 0 };
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
