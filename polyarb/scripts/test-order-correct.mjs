/**
 * Final probe: submit order with CORRECT params:
 *   - market with enableOrderBook: true
 *   - negRisk matching the market metadata
 *   - tries multiple variations to isolate root cause
 */
import { ethers } from 'ethers';
import { buildL2AuthHeaders } from '/app/dist/trading/clob-auth.js';
import { clobFetch } from '/app/dist/lib/clob-fetch.js';

const RAW_KEY    = process.env.POLYARB_WALLET_PRIVATE_KEY;
const API_KEY    = '1f508cec-84ab-afd8-2547-805adbc32ac0';
const API_SECRET = 'henlgyyft8jIzSUtjUkCsGWnzMb-K8KjM0g3WmJjUlg=';
const PASSPHRASE = '1dea4f3271ffc9a3d3dc7afc987d8081a7b006882c8edd3e1e6030ceba727615';
const CLOB_BASE  = 'https://clob.polymarket.com';

const pk = RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`;
const wallet = new ethers.Wallet(pk);
console.log('Wallet:', wallet.address);

// Pick a market WITH orderbook enabled (not the btc-updown-5m which has enableOrderBook=false)
const mRes = await fetch('https://gamma-api.polymarket.com/markets?slug=will-bitcoin-hit-150k-by-june-30-2026');
const [m] = await mRes.json();
console.log(`\nmarket: ${m.slug}`);
console.log(`  negRisk: ${m.negRisk}`);
console.log(`  enableOrderBook: ${m.enableOrderBook}`);
console.log(`  orderMinSize: ${m.orderMinSize}`);
console.log(`  feeType: ${m.feeType}`);
console.log(`  feeSchedule: ${JSON.stringify(m.feeSchedule)}`);
const tokenIds = JSON.parse(m.clobTokenIds);
const tokenId  = tokenIds[1];  // NO token (cheaper)
console.log(`  tokenId (NO): ${tokenId}`);

const ORDER_TYPES = {
  Order: [
    { name: 'salt',          type: 'uint256' },
    { name: 'maker',         type: 'address' },
    { name: 'signer',        type: 'address' },
    { name: 'taker',         type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'makerAmount',   type: 'uint256' },
    { name: 'takerAmount',   type: 'uint256' },
    { name: 'expiration',    type: 'uint256' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'feeRateBps',    type: 'uint256' },
    { name: 'side',          type: 'uint8'   },
    { name: 'signatureType', type: 'uint8'   },
  ],
};

async function trySign(label, opts) {
  const { contract, feeRateBps, sizeShares, price } = opts;
  const DOMAIN = {
    name: 'Polymarket CTF Exchange',
    version: '1',
    chainId: 137,
    verifyingContract: contract,
  };
  const usdc        = price * sizeShares;
  const makerAmount = BigInt(Math.round(usdc       * 1e6)).toString();
  const takerAmount = BigInt(Math.round(sizeShares * 1e6)).toString();
  const orderData = {
    salt:          BigInt(Date.now()).toString(),
    maker:         wallet.address,
    signer:        wallet.address,
    taker:         '0x0000000000000000000000000000000000000000',
    tokenId:       BigInt(tokenId).toString(),
    makerAmount,
    takerAmount,
    expiration:    '0',
    nonce:         '0',
    feeRateBps:    String(feeRateBps),
    side:          0,
    signatureType: 0,
  };
  const signature = await wallet.signTypedData(DOMAIN, ORDER_TYPES, orderData);
  const body = JSON.stringify({
    deferExec: false,
    order: { ...orderData, salt: Number(orderData.salt), side: 'BUY', signature },
    owner:     API_KEY,
    orderType: 'GTC',
  });
  const headers = buildL2AuthHeaders(
    API_KEY, API_SECRET, PASSPHRASE,
    wallet.address, 'POST', '/order', body,
  );
  const res = await clobFetch(`${CLOB_BASE}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  console.log(`\n[${label}]`);
  console.log(`  contract: ${contract.slice(0, 10)}... feeBps: ${feeRateBps} | size=${sizeShares}@${price}`);
  console.log(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
  return { ok: res.ok, status: res.status, text };
}

// 1. CTFExchange (regular, not negRisk) — matches market metadata
await trySign('CTFExchange + fee=1000', {
  contract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  feeRateBps: 1000,
  sizeShares: 5,
  price: 0.05,
});

// 2. CTFExchange + crypto_fees_v2 default rate 0.072 = 720 bps
await trySign('CTFExchange + fee=720', {
  contract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  feeRateBps: 720,
  sizeShares: 5,
  price: 0.05,
});

// 3. CTFExchange + fee=0
await trySign('CTFExchange + fee=0', {
  contract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  feeRateBps: 0,
  sizeShares: 5,
  price: 0.05,
});

// 4. NEG_RISK (just to confirm it fails since this market is not negRisk)
await trySign('NEG_RISK_CTFExchange (wrong contract for this mkt) + fee=1000', {
  contract: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  feeRateBps: 1000,
  sizeShares: 5,
  price: 0.05,
});
