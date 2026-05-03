/**
 * Coinbase International Exchange WebSocket — perps tickers + funding rates.
 *
 * Subscribes to:
 *   - INSTRUMENTS channel (snapshot + INCREMENTAL funding rate updates per hour)
 *   - LEVEL1 channel (best bid/ask)
 *
 * Public market-data feed at wss://ws-md.international.coinbase.com.
 * Auth is required only for user channels — not used here.
 *
 * API mirrors CoinbaseFeed deliberately so the loop can call getPrice / getFunding
 * without caring which venue is the source.
 */

import WebSocket from 'ws';

const WS_URL = 'wss://ws-md.international.coinbase.com';
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export interface IntxQuote {
  bid: number;
  ask: number;
  last: number;
  timestamp: number;
}

export interface IntxFunding {
  /** Per-hour funding rate (e.g. 0.0001 = 0.01% / hour). */
  ratePerHour: number;
  /** Next funding payment time (UTC ms). */
  nextFundingTime: number;
  /** Index price published with the funding update. */
  indexPrice: number;
  timestamp: number;
}

interface IntxTickerMsg {
  type?: string;
  channel?: string;
  product_id?: string;
  bid_price?: string;
  ask_price?: string;
  last_trade_price?: string;
  funding_rate?: string;
  next_funding_time?: string;
  index_price?: string;
  time?: string;
}

export class CoinbaseIntxFeed {
  private ws: WebSocket | null = null;
  private connected = false;
  private subscribed = false;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRun = true;

  private quotes = new Map<string, IntxQuote>();
  private fundings = new Map<string, IntxFunding>();
  private lastTickAt = 0;

  constructor(private readonly symbols: string[] = ['BTC-PERP', 'ETH-PERP']) {}

  get isConnected(): boolean { return this.connected; }
  get lastTickTimestamp(): number { return this.lastTickAt; }

  getQuote(symbol: string): IntxQuote | null {
    return this.quotes.get(symbol) ?? null;
  }

  getFunding(symbol: string): IntxFunding | null {
    return this.fundings.get(symbol) ?? null;
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
    this.subscribed = false;
  }

  private connect(): void {
    if (!this.shouldRun) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[intx-ws] Connected, subscribing to', this.symbols.join(', '));
        this.connected = true;
        this.reconnectDelay = RECONNECT_DELAY_MS;
        this.subscribe();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as IntxTickerMsg;
          if (!msg.product_id) return;
          this.lastTickAt = Date.now();

          if (msg.channel === 'LEVEL1' || msg.bid_price || msg.ask_price) {
            const bid = parseFloat(msg.bid_price ?? '0');
            const ask = parseFloat(msg.ask_price ?? '0');
            const last = parseFloat(msg.last_trade_price ?? '0') || (bid && ask ? (bid + ask) / 2 : 0);
            if (Number.isFinite(last) && last > 0) {
              this.quotes.set(msg.product_id, { bid, ask, last, timestamp: this.lastTickAt });
            }
          }

          if (msg.channel === 'INSTRUMENTS' || msg.funding_rate !== undefined) {
            const ratePerHour = parseFloat(msg.funding_rate ?? '0');
            const nextFundingTime = msg.next_funding_time
              ? Date.parse(msg.next_funding_time)
              : 0;
            const indexPrice = parseFloat(msg.index_price ?? '0');
            if (Number.isFinite(ratePerHour)) {
              this.fundings.set(msg.product_id, {
                ratePerHour,
                nextFundingTime,
                indexPrice,
                timestamp: this.lastTickAt,
              });
            }
          }
        } catch {
          // Skip malformed messages
        }
      });

      this.ws.on('close', () => {
        console.log('[intx-ws] Disconnected');
        this.connected = false;
        this.subscribed = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('[intx-ws] Error:', err.message);
        this.connected = false;
      });
    } catch (err) {
      console.error('[intx-ws] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.subscribed) return;

    const subscribeTo = (channel: string) => {
      this.ws!.send(JSON.stringify({
        type: 'SUBSCRIBE',
        channels: [channel],
        product_ids: this.symbols,
      }));
    };

    subscribeTo('LEVEL1');
    subscribeTo('INSTRUMENTS');
    this.subscribed = true;
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    console.log(`[intx-ws] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}
