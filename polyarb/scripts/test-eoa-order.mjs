/**
 * Try to actually POST a tiny EOA-signed order to Polymarket.
 * This bypasses /balance-allowance and tests whether the CLOB
 * accepts the order at submission time (when it would do its own
 * collateral check).
 *
 * If accepted (or rejected with "insufficient balance"): order signing/auth works.
 * If rejected with "invalid signer" or 401/403: api_key/mode is wrong.
 *
 * Run: node scripts/test-eoa-order.mjs
 */
import { ethers } from '/app/node_modules/ethers/dist/ethers.js';
import { ClobClient } from '/app/node_modules/@polymarket/clob-client/dist/index.js';

const RAW_KEY    = process.env.POLYARB_WALLET_PRIVATE_KEY;
const API_KEY    = '1f508cec-84ab-afd8-2547-805adbc32ac0';
const API_SECRET = 'henlgyyft8jIzSUtjUkCsGWnzMb-K8KjM0g3WmJjUlg=';
const PASSPHRASE = '1dea4f3271ffc9a3d3dc7afc987d8081a7b006882c8edd3e1e6030ceba727615';
const CLOB_BASE  = 'https://clob.polymarket.com';

const pk = RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`;
const wallet = new ethers.Wallet(pk);
console.log('Wallet:', wallet.address);

// Find a tradeable market
const evRes  = await fetch(`https://gamma-api.polymarket.com/events?active=true&closed=false&limit=10&tag_slug=bitcoin`);
const evData = await evRes.json();
const ev = evData.find(e => e.slug?.startsWith('btc-updown-5m-'));
if (!ev || !ev.markets?.[0]) { console.error('No btc-updown-5m market'); process.exit(1); }
const m = ev.markets[0];
const tokenId = JSON.parse(m.clobTokenIds)[0];
console.log('Market:', ev.slug, 'token:', tokenId.slice(0, 16) + '...');

// Try EOA mode (signatureType=0)
console.log('\n=== Testing signatureType=0 (EOA) ===');
const clob0 = new ClobClient(CLOB_BASE, 137, wallet,
  { key: API_KEY, secret: API_SECRET, passphrase: PASSPHRASE }, 0);
try {
  const o0 = await clob0.createOrder(
    { tokenID: tokenId, price: 0.05, side: 'BUY', size: 5, feeRateBps: 0 },
    { tickSize: '0.01', negRisk: true });
  console.log('  signed: maker=' + o0.maker + ' signer=' + o0.signer + ' sigType=' + o0.signatureType);
  const r0 = await clob0.postOrder(o0);
  console.log('  postOrder →', JSON.stringify(r0).slice(0, 400));
} catch(e) {
  console.error('  ERROR:', e?.message ?? e);
  console.error('  data:',  JSON.stringify(e?.response?.data ?? e?.data ?? null));
}

// Try Gnosis Safe mode (signatureType=2) since /balance-allowance shows MAX allowances there
console.log('\n=== Testing signatureType=2 (POLY_GNOSIS_SAFE) ===');
const clob2 = new ClobClient(CLOB_BASE, 137, wallet,
  { key: API_KEY, secret: API_SECRET, passphrase: PASSPHRASE }, 2);
try {
  const o2 = await clob2.createOrder(
    { tokenID: tokenId, price: 0.05, side: 'BUY', size: 5, feeRateBps: 0 },
    { tickSize: '0.01', negRisk: true });
  console.log('  signed: maker=' + o2.maker + ' signer=' + o2.signer + ' sigType=' + o2.signatureType);
  const r2 = await clob2.postOrder(o2);
  console.log('  postOrder →', JSON.stringify(r2).slice(0, 400));
} catch(e) {
  console.error('  ERROR:', e?.message ?? e);
  console.error('  data:',  JSON.stringify(e?.response?.data ?? e?.data ?? null));
}
