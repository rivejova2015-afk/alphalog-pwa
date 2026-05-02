/**
 * Same as test-real-order.mjs but signs the EIP-712 order against the
 * NEG_RISK CLOB-v2 contract, which is what the live /balance-allowance
 * endpoint reports as the active spender.
 *
 * If the prior test failed with `order_version_mismatch` against
 * NEG_RISK_CTF_EXCHANGE (0xC5d56…), this should fix it.
 */
import { ethers } from 'ethers';
import { buildL2AuthHeaders } from '/app/dist/trading/clob-auth.js';
import { clobFetch } from '/app/dist/lib/clob-fetch.js';

const RAW_KEY    = process.env.POLYARB_WALLET_PRIVATE_KEY;
const API_KEY    = '1f508cec-84ab-afd8-2547-805adbc32ac0';
const API_SECRET = 'henlgyyft8jIzSUtjUkCsGWnzMb-K8KjM0g3WmJjUlg=';
const PASSPHRASE = '1dea4f3271ffc9a3d3dc7afc987d8081a7b006882c8edd3e1e6030ceba727615';
const CLOB_BASE  = 'https://clob.polymarket.com';

if (!RAW_KEY) { console.error('POLYARB_WALLET_PRIVATE_KEY missing'); process.exit(1); }
const pk = RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`;
const wallet = new ethers.Wallet(pk);
console.log('Wallet:', wallet.address);

// Find a tradeable btc-updown-5m market
const evRes  = await fetch('https://gamma-api.polymarket.com/events?active=true&closed=false&limit=20&tag_slug=bitcoin');
const evData = await evRes.json();
const ev = evData.find(e => e.slug?.startsWith('btc-updown-5m-'));
if (!ev || !ev.markets?.[0]) { console.error('No btc-updown-5m market'); process.exit(1); }
const m = ev.markets[0];
const tokenIds = JSON.parse(m.clobTokenIds);
const tokenId  = tokenIds[0];
console.log('market:', ev.slug);

// Test multiple verifyingContract candidates against btc-updown-5m
const CANDIDATES = [
  { label: 'OLD NEG_RISK_CTF_EXCHANGE (current bot)',     addr: '0xC5d563A36AE78145C45a50134d48A1215220f80a' },
  { label: 'CLOB-NegRiskExchange-v2 (from balance-allow)', addr: '0xe2222d279d744050d28e00520010520000310F59' },
  { label: 'CLOB-CTFExchange-v2 (regular, v2)',           addr: '0xE111180000d2663C0091e4f400237545B87B996B' },
  { label: 'NegRiskAdapter',                              addr: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' },
];

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

async function trySign(verifyingContract, label) {
  const DOMAIN = {
    name: 'Polymarket CTF Exchange',
    version: '1',
    chainId: 137,
    verifyingContract,
  };
  // BUY 5 shares @ 0.05 = $0.25 USDC
  const price = 0.05;
  const shares = 5.00;
  const usdc   = 0.25;
  const makerAmount = BigInt(Math.round(usdc   * 1e6)).toString();
  const takerAmount = BigInt(Math.round(shares * 1e6)).toString();

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
    feeRateBps:    '1000',
    side:          0,
    signatureType: 0,
  };
  const signature = await wallet.signTypedData(DOMAIN, ORDER_TYPES, orderData);
  const body = JSON.stringify({
    deferExec: false,
    order: { ...orderData, salt: Number(orderData.salt), side: 'BUY' },
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
  console.log(`  contract: ${verifyingContract}`);
  console.log(`  HTTP ${res.status}: ${text.slice(0, 300)}`);
  return { ok: res.ok, status: res.status, text };
}

for (const c of CANDIDATES) {
  await trySign(c.addr, c.label);
}
