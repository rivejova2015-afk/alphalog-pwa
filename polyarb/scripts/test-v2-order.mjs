/**
 * Verify CLOB V2 signing on prod after migration.
 * Uses the bot's compiled OrderManager (post-V2 fix) to send a tiny order.
 *
 *   - btc-updown-5m market (negRisk=true)
 *   - BUY 5 shares @ 0.05 = $0.25 risk
 *
 * Expected: HTTP 200 with orderID OR a balance/collateral error
 *           (the latter is also acceptable — proves the signature is valid V2).
 *           If we still see "order_version_mismatch" the migration is incomplete.
 */
import { OrderManager } from '/app/dist/trading/order-manager.js';

const RAW_KEY    = process.env.POLYARB_WALLET_PRIVATE_KEY;
const API_KEY    = '1f508cec-84ab-afd8-2547-805adbc32ac0';
const API_SECRET = 'henlgyyft8jIzSUtjUkCsGWnzMb-K8KjM0g3WmJjUlg=';
const PASSPHRASE = '1dea4f3271ffc9a3d3dc7afc987d8081a7b006882c8edd3e1e6030ceba727615';

if (!RAW_KEY) { console.error('POLYARB_WALLET_PRIVATE_KEY missing'); process.exit(1); }
const pk = RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`;

console.log('[1/3] Finding orderbook-enabled market...');
const mRes = await fetch('https://gamma-api.polymarket.com/markets?slug=will-bitcoin-hit-150k-by-june-30-2026');
const [m] = await mRes.json();
if (!m) { console.error('Market not found'); process.exit(1); }
const tokenIds = JSON.parse(m.clobTokenIds);
const ev = { slug: m.slug };
console.log(`      market: ${m.slug}  conditionId: ${m.conditionId}`);
console.log(`      negRisk: ${m.negRisk}  enableOrderBook: ${m.enableOrderBook}`);

console.log('\n[2/3] Building OrderManager (EOA mode)...');
const om = new OrderManager(API_KEY, API_SECRET, PASSPHRASE, pk, false, null);

console.log('\n[3/3] Submitting BUY 5 @ 0.05 ($0.25)...');
const result = await om.placeOrder({
  conditionId:  m.conditionId,
  yesTokenId:   tokenIds[0],
  noTokenId:    tokenIds[1],
  marketSlug:   ev.slug,
  outcome:      'NO',
  side:         'BUY',
  price:        0.02,
  sizeUsd:      0.10,
  negRisk:      m.negRisk === true,
  agentId:      '7176f714-2116-4945-80ab-249320f1dae5',
  userId:       '00000000-0000-0000-0000-000000000000',
});

console.log('\n=== RESULT ===');
console.log(JSON.stringify(result, null, 2));

if (result.success) {
  console.log('\n✓ V2 SIGNING WORKS — order accepted by CLOB.');
  if (result.orderId) {
    console.log(`  Cancelling ${result.orderId} ...`);
    const cancelled = await om.cancelOrder(result.orderId);
    console.log(`  Cancel: ${cancelled}`);
  }
} else {
  const err = (result.error ?? '').toLowerCase();
  if (err.includes('order_version_mismatch')) {
    console.log('\n✗ STILL VERSION-MISMATCH — V2 migration incomplete.');
  } else if (err.includes('insufficient') || err.includes('balance') || err.includes('collateral')) {
    console.log('\n✓ V2 SIGNING WORKS — rejected only on collateral. Deposit USDC to trade.');
  } else {
    console.log('\n? V2 signing path different error — inspect above.');
  }
}
