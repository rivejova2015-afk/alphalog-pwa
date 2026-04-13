/**
 * Binance WebSocket price feed for BTC/USDT spot.
 *
 * Connects to wss://stream.binance.com:9443/ws/btcusdt@ticker
 * Maintains in-memory latest price + price history buffer.
 */

import WebSocket from 'ws';
import type { PriceSample } from '../skills/velocity-detector.js';

export interface BinancePrice {
  last: number;
  bid: number;
  ask: number;
  volume24h: number;
  changePct24h: number;
  timestamp: number;
}

const WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@ticker';
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const PRICE_HISTORY_MAX = 240; // 60s at 250ms intervals — used for vol calculation
const TIMESTAMPED_HISTORY_MS = 3_600_000; // Keep 1h of timestamped samples for velocity detector

export class BinanceFeed {
  private ws: WebSocket | null = null;
  private latestPrice: BinancePrice | null = null;
  private priceHistory: number[] = [];
  private timestampedSamples: PriceSample[] = []; // 1h ring buffer for velocity windows
  private connected = false;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRun = true;

  get isConnected(): boolean {
    return this.connected;
  }

  get price(): BinancePrice | null {
    return this.latestPrice;
  }

  get history(): number[] {
    return this.priceHistory;
  }

  /** Timestamped samples for the last 1h — used by VelocityDetector */
  getTimestampedSamples(): PriceSample[] {
    return this.timestampedSamples;
  }

  start(): void {
    this.shouldRun = true;
    this.connect();
  }

  stop(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private connect(): void {
    if (!this.shouldRun) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[binance-ws] Connected');
        this.connected = true;
        this.reconnectDelay = RECONNECT_DELAY_MS;
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            c?: string; // last price
            b?: string; // best bid
            a?: string; // best ask
            v?: string; // 24h volume
            P?: string; // 24h change percent
          };

          const last = parseFloat(msg.c ?? '0');
          if (last <= 0) return;

          this.latestPrice = {
            last,
            bid: parseFloat(msg.b ?? '0'),
            ask: parseFloat(msg.a ?? '0'),
            volume24h: parseFloat(msg.v ?? '0'),
            changePct24h: parseFloat(msg.P ?? '0'),
            timestamp: Date.now(),
          };

          // Append to plain history buffer (used for volatility calc)
          this.priceHistory.push(last);
          if (this.priceHistory.length > PRICE_HISTORY_MAX) {
            this.priceHistory.shift();
          }

          // Append to timestamped buffer (used by VelocityDetector — last 1h)
          const ts = Date.now();
          this.timestampedSamples.push({ price: last, timestamp: ts });
          // Prune samples older than 1h
          const cutoff = ts - TIMESTAMPED_HISTORY_MS;
          while (this.timestampedSamples.length > 0 && this.timestampedSamples[0].timestamp < cutoff) {
            this.timestampedSamples.shift();
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
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}
