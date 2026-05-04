/**
 * Exchange flows validator — STUB.
 *
 * CryptoQuant would supply net exchange inflow/outflow (inflow = bearish
 * pressure as holders deposit to sell; outflow = bullish as coins move to
 * cold storage).
 *
 * Until CRYPTOQUANT_API_KEY is set, returns null so the loop treats it as
 * neutral context.
 */

import type { Symbol } from '../core/config.js';

export interface ExchangeFlowResult {
  available: boolean;
  netFlowUsd: number | null;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  windowHours: number;
}

export async function fetchExchangeFlows(symbol: Symbol): Promise<ExchangeFlowResult> {
  void symbol;
  if (!process.env.CRYPTOQUANT_API_KEY) {
    return { available: false, netFlowUsd: null, bias: 'NEUTRAL', windowHours: 24 };
  }
  // TODO: wire CryptoQuant /v1/btc/exchange-flows/inflow + outflow.
  return { available: false, netFlowUsd: null, bias: 'NEUTRAL', windowHours: 24 };
}
