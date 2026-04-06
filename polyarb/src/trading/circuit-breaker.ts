/**
 * Circuit Breaker System — 6 kill switches
 *
 * 1. Daily drawdown stop (-35%)
 * 2. Hourly drawdown stop (-20%)
 * 3. Consecutive loss limit (7)
 * 4. Latency overrun (>100ms warn, >200ms skip)
 * 5. Slippage exceeded (>1.5%)
 * 6. Heartbeat / WS disconnect (60s stale)
 */

import type { TradingParams } from '../config.js';

export type TriggerType =
  | 'MAX_DAILY_DRAWDOWN'
  | 'MAX_HOURLY_DRAWDOWN'
  | 'CONSECUTIVE_LOSSES'
  | 'LATENCY_OVERRUN'
  | 'SLIPPAGE_EXCEEDED'
  | 'WS_DISCONNECT'
  | 'MANUAL_KILL'
  | 'ERROR_RATE'
  | 'HEARTBEAT_STALE';

export type ActionTaken = 'PAUSE' | 'STOP' | 'CLOSE_ALL' | 'WARN';
export type Severity = 'S1' | 'S2' | 'S3';

export interface CircuitBreakerEvent {
  triggerType: TriggerType;
  severity: Severity;
  detail: string;
  equityAtTrigger: number;
  actionTaken: ActionTaken;
}

export interface CircuitBreakerState {
  tradingEnabled: boolean;
  pausedUntil: number | null;       // epoch ms
  reduceSizeNextTrade: boolean;     // slippage flag
  lastDailyCheck: number;           // epoch ms
  startOfDayEquity: number;
  startOfHourEquity: number;
  hourStartTimestamp: number;
  events: CircuitBreakerEvent[];    // pending events to flush
}

export function createCircuitBreakerState(startingEquity: number): CircuitBreakerState {
  return {
    tradingEnabled: true,
    pausedUntil: null,
    reduceSizeNextTrade: false,
    lastDailyCheck: Date.now(),
    startOfDayEquity: startingEquity,
    startOfHourEquity: startingEquity,
    hourStartTimestamp: Date.now(),
    events: [],
  };
}

/**
 * Run all circuit breaker checks. Mutates state and returns list of triggered events.
 */
export function checkCircuitBreakers(
  state: CircuitBreakerState,
  currentEquity: number,
  consecutiveLosses: number,
  lastLatencyMs: number,
  lastSlippage: number,
  wsBinanceConnected: boolean,
  wsPolymarketConnected: boolean,
  params: TradingParams
): CircuitBreakerEvent[] {
  const now = Date.now();
  const newEvents: CircuitBreakerEvent[] = [];

  // Check if pause has expired
  if (state.pausedUntil && now >= state.pausedUntil) {
    state.pausedUntil = null;
    state.tradingEnabled = true;
  }

  // Reset hour if needed
  if (now - state.hourStartTimestamp >= 3_600_000) {
    state.startOfHourEquity = currentEquity;
    state.hourStartTimestamp = now;
  }

  // Reset day if needed (simple: every 24h)
  if (now - state.lastDailyCheck >= 86_400_000) {
    state.startOfDayEquity = currentEquity;
    state.lastDailyCheck = now;
  }

  // 1. Daily drawdown
  if (state.startOfDayEquity > 0) {
    const dailyReturn = (currentEquity - state.startOfDayEquity) / state.startOfDayEquity;
    if (dailyReturn < params.dailyDrawdownLimit) {
      const evt: CircuitBreakerEvent = {
        triggerType: 'MAX_DAILY_DRAWDOWN',
        severity: 'S1',
        detail: `Daily return ${(dailyReturn * 100).toFixed(2)}% < ${(params.dailyDrawdownLimit * 100).toFixed(0)}% limit`,
        equityAtTrigger: currentEquity,
        actionTaken: 'CLOSE_ALL',
      };
      newEvents.push(evt);
      state.tradingEnabled = false;
    }
  }

  // 2. Hourly drawdown
  if (state.startOfHourEquity > 0) {
    const hourlyReturn = (currentEquity - state.startOfHourEquity) / state.startOfHourEquity;
    if (hourlyReturn < params.hourlyDrawdownLimit) {
      const evt: CircuitBreakerEvent = {
        triggerType: 'MAX_HOURLY_DRAWDOWN',
        severity: 'S2',
        detail: `Hourly return ${(hourlyReturn * 100).toFixed(2)}% < ${(params.hourlyDrawdownLimit * 100).toFixed(0)}% limit`,
        equityAtTrigger: currentEquity,
        actionTaken: 'PAUSE',
      };
      newEvents.push(evt);
      state.tradingEnabled = false;
      state.pausedUntil = now + 3_600_000; // pause 1 hour
    }
  }

  // 3. Consecutive losses
  if (consecutiveLosses >= params.consecutiveLossLimit) {
    const evt: CircuitBreakerEvent = {
      triggerType: 'CONSECUTIVE_LOSSES',
      severity: 'S2',
      detail: `${consecutiveLosses} consecutive losses >= ${params.consecutiveLossLimit} limit`,
      equityAtTrigger: currentEquity,
      actionTaken: 'PAUSE',
    };
    newEvents.push(evt);
    state.tradingEnabled = false;
    state.pausedUntil = now + 7_200_000; // pause 2 hours
  }

  // 4. Latency overrun
  if (lastLatencyMs > 200) {
    const evt: CircuitBreakerEvent = {
      triggerType: 'LATENCY_OVERRUN',
      severity: 'S3',
      detail: `Execution latency ${lastLatencyMs}ms > 200ms limit`,
      equityAtTrigger: currentEquity,
      actionTaken: 'WARN',
    };
    newEvents.push(evt);
    // Don't disable trading, just skip this order (handled in loop)
  }

  // 5. Slippage
  if (lastSlippage > params.maxSlippage) {
    const evt: CircuitBreakerEvent = {
      triggerType: 'SLIPPAGE_EXCEEDED',
      severity: 'S3',
      detail: `Slippage ${(lastSlippage * 100).toFixed(2)}% > ${(params.maxSlippage * 100).toFixed(1)}% limit`,
      equityAtTrigger: currentEquity,
      actionTaken: 'WARN',
    };
    newEvents.push(evt);
    state.reduceSizeNextTrade = true; // reduce by 20% next trade
  }

  // 6. WebSocket disconnect
  if (!wsBinanceConnected || !wsPolymarketConnected) {
    const evt: CircuitBreakerEvent = {
      triggerType: 'WS_DISCONNECT',
      severity: 'S2',
      detail: `WS disconnected: Binance=${wsBinanceConnected}, Polymarket=${wsPolymarketConnected}`,
      equityAtTrigger: currentEquity,
      actionTaken: 'PAUSE',
    };
    newEvents.push(evt);
    state.tradingEnabled = false;
  }

  state.events.push(...newEvents);
  return newEvents;
}

/**
 * Drain pending events (for flushing to Supabase).
 */
export function drainEvents(state: CircuitBreakerState): CircuitBreakerEvent[] {
  const events = [...state.events];
  state.events = [];
  return events;
}
