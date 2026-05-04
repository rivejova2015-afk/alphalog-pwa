/**
 * Binance WebSocket multi-asset price feed.
 *
 * Uses Binance combined stream to track BTC, ETH, and SOL simultaneously.
 * Maintains timestamped price history (1h) per asset for:
 *   - VelocityDetector (BTC primary)
 *   - CrossMarketConfirmation (ETH + SOL secondary)
 *   - RegimeDetector (BTC volatility)
 */

import WebSocket from 'ws';
import type { PriceSample } from './coinbase-ws.js';

export interface BinancePrice {
  last: number;
  bid: number;
  ask: number;
  volume24h: number;
  changePct24h: number;
  timestamp: number;
}

// Combined stream endpoint — all 3 assets in one connection
const WS_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker';
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const PRICE_HISTORY_MAX = 240;        // 60s plain buffer for vol calc
const TIMESTAMPED_HISTORY_MS = 3_600_000; // 1h timestamped buffer per asset

type AssetSymbol = 'BTC' | 'ETH' | 'SOL';

const STREAM_TO_SYMBOL: Record<string, AssetSymbol> = {
  btcusdt: 'BTC',
  ethusdt: 'ETH',
  solusdt: 'SOL',
};

export class BinanceFeed {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRun = true;

  // Per-asset state
  private prices: Map<AssetSymbol, BinancePrice> = new Map();
  private histories: Map<AssetSymbol, number[]> = new Map([
    ['BTC', []], ['ETH', []], ['SOL', []],
  ]);
  private timestampedSamples: Map<AssetSymbol, PriceSample[]> = new Map([
    ['BTC', []], ['ETH', []], ['SOL', []],
  ]);

  get isConnected(): boolean { return this.connected; }

  /** Latest BTC price (primary) */
  get price(): BinancePrice | null { return this.prices.get('BTC') ?? null; }

  /** Plain BTC price history for vol calc */
  get history(): number[] { return this.histories.get('BTC') ?? []; }

  /** Timestamped BTC samples for VelocityDetector (last 1h) */
  getTimestampedSamples(symbol: AssetSymbol = 'BTC'): PriceSample[] {
    return this.timestampedSamples.get(symbol) ?? [];
  }

  /** Latest price for any tracked asset */
  getPrice(symbol: AssetSymbol): BinancePrice | null {
    return this.prices.get(symbol) ?? null;
  }

  start(): void {
    this.shouldRun = true;
    this.connect();
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
  }

  private connect(): void {
    if (!this.shouldRun) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[binance-ws] Connected (BTC+ETH+SOL combined stream)');
        this.connected = true;
        this.reconnectDelay = RECONNECT_DELAY_MS;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          // Combined stream format: { stream: "btcusdt@ticker", data: {...} }
          const envelope = JSON.parse(data.toString()) as {
            stream?: string;
            data?: {
              c?: string; b?: string; a?: string; v?: string; P?: string;
            };
          };

          if (!envelope.stream || !envelope.data) return;

          // Extract base symbol from stream name (e.g. "btcusdt@ticker" → "btcusdt")
          const streamBase = envelope.stream.split('@')[0];
          const symbol = STREAM_TO_SYMBOL[streamBase];
          if (!symbol) return;

          const msg = envelope.data;
          const last = parseFloat(msg.c ?? '0');
          if (last <= 0) return;

          const ts = Date.now();

          this.prices.set(symbol, {
            last,
            bid: parseFloat(msg.b ?? '0'),
            ask: parseFloat(msg.a ?? '0'),
            volume24h: parseFloat(msg.v ?? '0'),
            changePct24h: parseFloat(msg.P ?? '0'),
            timestamp: ts,
          });

          // Plain history (BTC only for vol calc)
          if (symbol === 'BTC') {
            const h = this.histories.get('BTC')!;
            h.push(last);
            if (h.length > PRICE_HISTORY_MAX) h.shift();
          }

          // Timestamped history (all 3 assets)
          const tsBuf = this.timestampedSamples.get(symbol)!;
          tsBuf.push({ price: last, timestamp: ts });
          const cutoff = ts - TIMESTAMPED_HISTORY_MS;
          while (tsBuf.length > 0 && tsBuf[0].timestamp < cutoff) {
            tsBuf.shift();
          }
        } catch {
          // Skip malformed messages
        }
      });

      this.ws.on('close', () => {
        console.log('[binance-ws] Disconnected');
        this.connected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('[binance-ws] Error:', err.message);
        this.connected = false;
      });
    } catch (err) {
      console.error('[binance-ws] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    console.log(`[binance-ws] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}
