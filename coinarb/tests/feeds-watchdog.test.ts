import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal WebSocket stub. The feeds only call .on / .close / .send / readyState
// during their lifecycle — nothing more. We capture .close calls so the watchdog
// assertion is straightforward, and let .on register handlers so the test can
// drive 'message' events.
const closeCalls: string[] = [];

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = FakeWebSocket.OPEN;
  private listeners: Record<string, ((arg?: unknown) => void)[]> = {};
  constructor(public url: string) {}
  on(event: string, cb: (arg?: unknown) => void) { (this.listeners[event] ??= []).push(cb); }
  close() { closeCalls.push(this.url); this.readyState = FakeWebSocket.CLOSED; }
  send(_data: string) { /* no-op */ }
  // Helper for tests to inject messages
  __emit(event: string, arg?: unknown) { this.listeners[event]?.forEach(cb => cb(arg)); }
}

vi.mock('ws', () => ({
  default: FakeWebSocket,
  WebSocket: FakeWebSocket,
}));

const { CoinbaseFeed } = await import('../src/feeds/coinbase-ws.js');
const { BinanceFeed } = await import('../src/feeds/binance-ws.js');

type WatchdogReadable<T> = T & {
  ws: FakeWebSocket | null;
  connected: boolean;
  lastMessageAt: number;
  watchdog: () => void;
};

describe('CoinbaseFeed silent-hang watchdog', () => {
  beforeEach(() => {
    closeCalls.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when not connected', () => {
    const feed = new CoinbaseFeed() as unknown as WatchdogReadable<CoinbaseFeed>;
    feed.connected = false;
    feed.lastMessageAt = Date.now() - 999_999;
    feed.watchdog();
    expect(closeCalls).toHaveLength(0);
  });

  it('does nothing when no message has arrived yet (lastMessageAt=0)', () => {
    const feed = new CoinbaseFeed() as unknown as WatchdogReadable<CoinbaseFeed>;
    feed.connected = true;
    feed.lastMessageAt = 0;
    feed.watchdog();
    expect(closeCalls).toHaveLength(0);
  });

  it('forces close when silence exceeds 60s threshold', () => {
    const feed = new CoinbaseFeed() as unknown as WatchdogReadable<CoinbaseFeed>;
    feed.connected = true;
    feed.lastMessageAt = Date.now() - 61_000;
    feed.ws = new FakeWebSocket('wss://test') as unknown as FakeWebSocket;
    feed.watchdog();
    expect(closeCalls).toHaveLength(1);
    expect(feed.connected).toBe(false);
  });

  it('does not close when silence is below threshold', () => {
    const feed = new CoinbaseFeed() as unknown as WatchdogReadable<CoinbaseFeed>;
    feed.connected = true;
    feed.lastMessageAt = Date.now() - 30_000;
    feed.ws = new FakeWebSocket('wss://test') as unknown as FakeWebSocket;
    feed.watchdog();
    expect(closeCalls).toHaveLength(0);
    expect(feed.connected).toBe(true);
  });
});

describe('BinanceFeed silent-hang watchdog', () => {
  beforeEach(() => {
    closeCalls.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forces close when silence exceeds 60s threshold', () => {
    const feed = new BinanceFeed() as unknown as WatchdogReadable<BinanceFeed>;
    feed.connected = true;
    feed.lastMessageAt = Date.now() - 61_000;
    feed.ws = new FakeWebSocket('wss://test') as unknown as FakeWebSocket;
    feed.watchdog();
    expect(closeCalls).toHaveLength(1);
    expect(feed.connected).toBe(false);
  });

  it('does not close on fresh message', () => {
    const feed = new BinanceFeed() as unknown as WatchdogReadable<BinanceFeed>;
    feed.connected = true;
    feed.lastMessageAt = Date.now() - 5_000;
    feed.ws = new FakeWebSocket('wss://test') as unknown as FakeWebSocket;
    feed.watchdog();
    expect(closeCalls).toHaveLength(0);
    expect(feed.connected).toBe(true);
  });
});
