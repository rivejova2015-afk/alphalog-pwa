import type { HestonParams } from "@/lib/bot/signal-engine/types";

export interface SurfacePoint {
  strike: number;    // absolute strike price
  moneyness: number; // K/S
  expiry: number;    // years
  iv: number;        // implied vol [0, 1]
  callPrice: number;
}

export interface SurfaceGrid {
  points: SurfacePoint[];
  strikes: number[];  // 21 relative strikes (moneyness)
  expiries: number[]; // 7 expiries in years
  spot: number;
  computedAt: string;
}

// Moneyness grid: 0.85 to 1.15 in 21 steps
const MONEYNESS = Array.from({ length: 21 }, (_, i) => 0.85 + i * 0.015);
// Expiry grid: 1 day to 1 year
const EXPIRIES = [1 / 365, 7 / 365, 14 / 365, 1 / 12, 3 / 12, 6 / 12, 1.0];
const RISK_FREE = 0.045; // ~4.5% USD risk-free
const N_INTEGRATION = 128; // Simpson rule intervals (must be even)

// ─────────────────────────────────────────────────────────────────────────────
// Heston characteristic function φ(u) for log-price under risk-neutral measure
// Lewis (2001) formulation
// ─────────────────────────────────────────────────────────────────────────────
function hestonCharFunc(
  u: [number, number], // complex u = [real, imag]
  S: number,
  K: number,
  T: number,
  r: number,
  params: HestonParams
): [number, number] {
  const { kappa, theta, sigma, rho, v0 } = params;
  const x = Math.log(S / K) + r * T;

  // d = sqrt((rho*sigma*i*u - kappa)^2 + sigma^2*(i*u + u^2))
  // Working with complex arithmetic manually for performance
  const [ur, ui] = u;

  // i*u = [-ui, ur]
  const iur = -ui;
  const iui = ur;

  // rho*sigma*i*u = rho*sigma*[-ui, ur]
  const rs_r = rho * sigma * iur;
  const rs_i = rho * sigma * iui;

  // rho*sigma*i*u - kappa
  const a_r = rs_r - kappa;
  const a_i = rs_i;

  // sigma^2*(i*u + u^2) = sigma^2*([-ui + ur^2 - ui^2], [ur + 2*ur*ui])
  const u2r = ur * ur - ui * ui;
  const u2i = 2 * ur * ui;
  const b_r = sigma * sigma * (iur + u2r);
  const b_i = sigma * sigma * (iui + u2i);

  // d^2 = a^2 + b
  const d2r = a_r * a_r - a_i * a_i + b_r;
  const d2i = 2 * a_r * a_i + b_i;

  // d = sqrt(d^2): sqrt of complex
  const d2mod = Math.sqrt(d2r * d2r + d2i * d2i);
  const d2arg = Math.atan2(d2i, d2r);
  const dmod = Math.pow(d2mod, 0.5);
  const darg = d2arg / 2;
  const dr = dmod * Math.cos(darg);
  const di = dmod * Math.sin(darg);

  // g = (a - d) / (a + d)
  const numr = a_r - dr;
  const numi = a_i - di;
  const denr = a_r + dr;
  const deni = a_i + di;
  const denmod2 = denr * denr + deni * deni;
  const gr = (numr * denr + numi * deni) / denmod2;
  const gi = (numi * denr - numr * deni) / denmod2;

  // exp(d*T) = exp(dr*T) * [cos(di*T) + i*sin(di*T)]
  const expDT = Math.exp(dr * T);
  const eDTr = expDT * Math.cos(di * T);
  const eDTi = expDT * Math.sin(di * T);

  // D(u) = (a-d)/sigma^2 * (1 - exp(dT)) / (1 - g*exp(dT))
  // numerator: (a-d)*(1 - eDT)
  const one_eDTr = 1 - eDTr;
  const one_eDTi = -eDTi;
  const nD_r = numr * one_eDTr - numi * one_eDTi;
  const nD_i = numr * one_eDTi + numi * one_eDTr;

  // denominator: 1 - g*eDT
  const geDTr = gr * eDTr - gi * eDTi;
  const geDTi = gr * eDTi + gi * eDTr;
  const denD2r = 1 - geDTr;
  const denD2i = -geDTi;
  const denD2mod2 = denD2r * denD2r + denD2i * denD2i;
  const D_r = (nD_r * denD2r + nD_i * denD2i) / (sigma * sigma * denD2mod2);
  const D_i = (nD_i * denD2r - nD_r * denD2i) / (sigma * sigma * denD2mod2);

  // C(u) = r*i*u*T + kappa*theta/sigma^2 * [(a-d)*T - 2*ln((1 - g*eDT)/(1-g))]
  // ln((1-g*eDT)/(1-g))
  const one_gr = 1 - gr;
  const one_gi = -gi;
  const ratior = (denD2r * one_gr + denD2i * one_gi) / (one_gr * one_gr + one_gi * one_gi);
  const ratioi = (denD2i * one_gr - denD2r * one_gi) / (one_gr * one_gr + one_gi * one_gi);
  const lnr = Math.log(Math.sqrt(ratior * ratior + ratioi * ratioi));
  const lni = Math.atan2(ratioi, ratior);

  const C_r = r * iur * T + (kappa * theta / (sigma * sigma)) * ((a_r - dr) * T - 2 * lnr);
  const C_i = r * iui * T + (kappa * theta / (sigma * sigma)) * ((a_i - di) * T - 2 * lni);

  // phi = exp(C + D*v0 + i*u*x)
  // i*u*x: x is real, so [i*u*x] = [-ui*x, ur*x]
  const exponent_r = C_r + D_r * v0 + iur * x;
  const exponent_i = C_i + D_i * v0 + iui * x;
  const emod = Math.exp(exponent_r);
  return [emod * Math.cos(exponent_i), emod * Math.sin(exponent_i)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Heston call price via Lewis (2001) semi-analytic formula
// C = S*N(d1) - K*e^{-rT}*N(d2) adjusted via Fourier
// Using the real part of the integral representation
// ─────────────────────────────────────────────────────────────────────────────
function hestonCallPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  params: HestonParams
): number {
  if (T <= 0) return Math.max(S - K, 0);

  // Integral over u from 0 to infinity using Simpson's rule
  const upperLimit = 300;
  const h = upperLimit / N_INTEGRATION;
  let integral = 0;

  for (let j = 0; j <= N_INTEGRATION; j++) {
    const u = j * h + 1e-10; // avoid u=0 exactly
    // integrand: Re[exp(-i*u*ln(K/S)) * phi(u - i/2, ...)] / (u^2 + 1/4)
    // Lewis (2001) simplified form
    const u_shifted: [number, number] = [u, -0.5];
    const [phiR, phiI] = hestonCharFunc(u_shifted, S, K, T, r, params);

    const lnKS = Math.log(K / S);
    // exp(-i*u*ln(K/S)) = cos(u*lnKS) - i*sin(u*lnKS)
    const expR = Math.cos(u * lnKS);
    const expI = -Math.sin(u * lnKS);

    // product real part
    const productR = expR * phiR - expI * phiI;
    const denom = u * u + 0.25;
    const integrand = productR / denom;

    const weight = j === 0 || j === N_INTEGRATION ? 1 : j % 2 === 0 ? 2 : 4;
    integral += weight * integrand;
  }
  integral *= h / 3;

  const callPrice = S - (Math.sqrt(S * K) * Math.exp(-r * T) / Math.PI) * integral;
  return Math.max(callPrice, Math.max(S - K * Math.exp(-r * T), 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// Black-Scholes call for implied vol inversion
// ─────────────────────────────────────────────────────────────────────────────
function bsCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (sigma <= 0 || T <= 0) return Math.max(S - K * Math.exp(-r * T), 0);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
}

function normCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x / 2)));
}

// Newton-Raphson implied vol inversion
function impliedVol(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number
): number {
  if (marketPrice <= 0) return 0.01;
  const intrinsic = Math.max(S - K * Math.exp(-r * T), 0);
  if (marketPrice <= intrinsic + 1e-8) return 0.001;

  let sigma = 0.3; // initial guess
  for (let iter = 0; iter < 100; iter++) {
    const price = bsCall(S, K, T, r, sigma);
    const diff = price - marketPrice;
    if (Math.abs(diff) < 1e-6) break;
    // vega = S * phi(d1) * sqrt(T)
    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const vega = S * Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI) * sqrtT;
    if (vega < 1e-10) { sigma = Math.max(sigma - 0.01, 0.001); continue; }
    sigma = sigma - diff / vega;
    sigma = Math.max(0.001, Math.min(5.0, sigma));
  }
  return sigma;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: compute full 21×7 IV surface
// ─────────────────────────────────────────────────────────────────────────────
export function calculateIVSurface(params: HestonParams, spot: number): SurfaceGrid {
  const points: SurfacePoint[] = [];

  for (const T of EXPIRIES) {
    for (const m of MONEYNESS) {
      const K = spot * m;
      const callPrice = hestonCallPrice(spot, K, T, RISK_FREE, params);
      const iv = impliedVol(callPrice, spot, K, T, RISK_FREE);
      points.push({
        strike: K,
        moneyness: m,
        expiry: T,
        iv: Math.min(Math.max(iv, 0.001), 5.0),
        callPrice,
      });
    }
  }

  return {
    points,
    strikes: MONEYNESS,
    expiries: EXPIRIES,
    spot,
    computedAt: new Date().toISOString(),
  };
}

// Estimate Heston params from tick data (method of moments approximation)
export function estimateHestonParams(
  ticks: Array<{ last: number; bid: number; ask: number }>,
  fallback: HestonParams
): HestonParams {
  if (ticks.length < 10) return fallback;

  const prices = ticks.map((t) => t.last).filter(Boolean);
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  if (returns.length < 5) return fallback;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const v0 = Math.max(variance * (365 * 96), 0.0001); // annualize 15min variance

  const spreads = ticks.map((t) => (t.ask - t.bid) / t.last).filter(Boolean);
  const avgSpread = spreads.reduce((s, x) => s + x, 0) / spreads.length;

  return {
    kappa: fallback.kappa,
    theta: Math.max(v0 * 0.8, 0.0001),
    sigma: Math.min(Math.max(avgSpread * 20, 0.1), 1.5),
    rho: fallback.rho,
    v0,
  };
}
