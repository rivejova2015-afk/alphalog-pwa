/**
 * Coinbase WebSocket multi-asset price feed.
 *
 * Public ticker channel via wss://ws-feed.exchange.coinbase.com.
 * Subscribes to BTC-USD, ETH-USD and SOL-USD so consensus-spot can build a
 * Binance + Coinbase median spot price for the 500x loop.
 *
 * API mirrors BinanceFeed deliberately so swapping/combining feeds at the
 * call-site is mechanical: same getPrice/history/timestamped accessors,
 * same isConnected/start/stop lifecycle.
 */

import WebSocket from 'ws';

export interface PriceSample {
  price: number;
  timestamp: number;
}

export interface CoinbasePrice {
  last: number;
  bid: number;
  ask: number;
  volume24h: number;
  changePct24h: number;
  timestamp: number;
}

const WS_URL = 'wss://ws-feed.exchange.coinbase.com';
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const PRICE_HISTORY_MAX = 240;
const TIMESTAMPED_HISTORY_MS = 3_600_000;

type AssetSymbol = 'BTC' | 'ETH' | 'SOL';

const PRODUCT_TO_SYMBOL: Record<string, AssetSymbol> = {
  'BTC-USD': 'BTC',
  'ETH-USD': 'ETH',
  'SOL-USD': 'SOL',
};

const PRODUCT_IDS = Object.keys(PRODUCT_TO_SYMBOL);

interface CoinbaseTickerMessage {
  type?: string;
  product_id?: string;
  price?: string;
  best_bid?: string;
  best_ask?: string;
  volume_24h?: string;
  open_24h?: string;
}

export class CoinbaseFeed {
  private ws: WebSocket | null = null;
  private connected = false;
  private subscribed = false;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRun = true;

  private prices: Map<AssetSymbol, CoinbasePrice> = new Map();
  private histories: Map<AssetSymbol, number[]> = new Map([
    ['BTC', []], ['ETH', []], ['SOL', []],
  ]);
  private timestampedSamples: Map<AssetSymbol, PriceSample[]> = new Map([
    ['BTC', []], ['ETH', []], ['SOL', []],
  ]);

  get isConnected(): boolean { return this.connected; }
  get price(): CoinbasePrice | null { return this.prices.get('BTC') ?? null; }
  get history(): number[] { return this.histories.get('BTC') ?? []; }

  getTimestampedSamples(symbol: AssetSymbol = 'BTC'): PriceSample[] {
    return this.timestampedSamples.get(symbol) ?? [];
  }

  getPrice(symbol: AssetSymbol): CoinbasePrice | null {
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
    this.subscribed = false;
  }

  private connect(): void {
    if (!this.shouldRun) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[coinbase-ws] Connected, subscribing to', PRODUCT_IDS.join(', '));
        this.connected = true;
        this.reconnectDelay = RECONNECT_DELAY_MS;
        this.subscribe();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString()) as CoinbaseTickerMessage;
          if (msg.type !== 'ticker' || !msg.product_id) return;

          const symbol = PRODUCT_TO_SYMBOL[msg.product_id];
          if (!symbol) return;

          const last = parseFloat(msg.price ?? '0');
          if (!Number.isFinite(last) || last <= 0) return;

          const bid = parseFloat(msg.best_bid ?? '0');
          const ask = parseFloat(msg.best_ask ?? '0');
          const volume24h = parseFloat(msg.volume_24h ?? '0');
          const open24h = parseFloat(msg.open_24h ?? '0');
          const changePct24h = open24h > 0 ? ((last - open24h) / open24h) * 100 : 0;

          const ts = Date.now();
          this.prices.set(symbol, { last, bid, ask, volume24h, changePct24h, timestamp: ts });

          if (symbol === 'BTC') {
            const h = this.histories.get('BTC')!;
            h.push(last);
            if (h.length > PRICE_HISTORY_MAX) h.shift();
          }

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
        console.log('[coinbase-ws] Disconnected');
        this.connected = false;
        this.subscribed = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error('[coinbase-ws] Error:', err.message);
        this.connected = false;
      });
    } catch (err) {
      console.error('[coinbase-ws] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.subscribed) return;
    const payload = {
      type: 'subscribe',
      product_ids: PRODUCT_IDS,
      channels: ['ticker'],
    };
    this.ws.send(JSON.stringify(payload));
    this.subscribed = true;
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return;
    console.log(`[coinbase-ws] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => { this.connect(); }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}
