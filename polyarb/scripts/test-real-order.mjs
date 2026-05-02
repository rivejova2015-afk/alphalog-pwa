/**
 * Submit a tiny real order to Polymarket using the bot's exact code path.
 * Run inside the polyarb-50x container so /app/dist is available.
 *
 * What this answers:
 *   - Does Polymarket accept EOA-mode orders even when /balance-allowance reports balance=0?
 *   - If rejected, with what error? (insufficient collateral vs invalid signer vs other)
 *
 * Order placed:
 *   - btc-updown-5m market (cheapest available)
 *   - BUY at 0.05 (5 cents), size $0.25
 *   - Total at risk if filled: $0.25 worst case
 */

import { OrderManager } from '/app/dist/trading/order-manager.js';

const RAW_KEY    = process.env.POLYARB_WALLET_PRIVATE_KEY;
const API_KEY    = '1f508cec-84ab-afd8-2547-805adbc32ac0';
const API_SECRET = 'henlgyyft8jIzSUtjUkCsGWnzMb-K8KjM0g3WmJjUlg=';
const PASSPHRASE = '1dea4f3271ffc9a3d3dc7afc987d8081a7b006882c8edd3e1e6030ceba727615';

if (!RAW_KEY) { console.error('POLYARB_WALLET_PRIVATE_KEY missing'); process.exit(1); }
const pk = RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`;

// Find a tradeable btc-updown-5m market via gamma
console.log('[1/3] Finding market...');
const evRes  = await fetch('https://gamma-api.polymarket.com/events?active=true&closed=false&limit=20&tag_slug=bitcoin');
const evData = await evRes.json();
const ev = evData.find(e => e.slug?.startsWith('btc-updown-5m-'));
if (!ev || !ev.markets?.[0]) { console.error('No btc-updown-5m market'); process.exit(1); }
const m = ev.markets[0];
const tokenIds = JSON.parse(m.clobTokenIds);
const yesTokenId = tokenIds[0];
const noTokenId  = tokenIds[1];
console.log(`      market: ${ev.slug}`);
console.log(`      conditionId: ${m.conditionId}`);
console.log(`      yesToken: ${yesTokenId.slice(0, 20)}...`);

// Build OrderManager using the bot's exact code path (EOA mode, dryRun=false)
console.log('\n[2/3] Building OrderManager (EOA mode)...');
const om = new OrderManager(API_KEY, API_SECRET, PASSPHRASE, pk, false, null);

// Placeorder with the absolute minimum size that's likely to be rejected on price
// (0.05 is below mid for a far-OTM token) — so it stays open or rejects on collateral.
console.log('\n[3/3] Submitting BUY 5 contracts @ 0.05 ($0.25 risk)...');
const result = await om.placeOrder({
  conditionId:  m.conditionId,
  yesTokenId,
  noTokenId,
  marketSlug:   ev.slug,
  outcome:      'YES',
  side:         'BUY',
  price:        0.05,
  sizeUsd:      0.25,
  feeRateBps:   1000,
  negRisk:      true,        // btc-updown-5m markets are NEG_RISK
  agentId:      '7176f714-2116-4945-80ab-249320f1dae5',
  userId:       '00000000-0000-0000-0000-000000000000',  // dummy — will be overwritten by RLS if insert succeeds
});

console.log('\n=== RESULT ===');
console.log(JSON.stringify(result, null, 2));

if (result.success) {
  console.log('\n✓ ORDER ACCEPTED — EOA mode works! Bot is good to go.');
  if (result.orderId) {
    console.log(`  Cancelling ${result.orderId} to avoid leaving open order...`);
    const cancelled = await om.cancelOrder(result.orderId);
    console.log(`  Cancel result: ${cancelled}`);
  }
} else {
  console.log(`\n✗ ORDER REJECTED — error: ${result.error}`);
  if (result.error?.toLowerCase().includes('insufficient')) {
    console.log('  Diagnosis: Polymarket sees no collateral. Need to deposit via polymarket.com OR move funds to proxy.');
  } else if (result.error?.toLowerCase().includes('signer') || result.error?.toLowerCase().includes('signature')) {
    console.log('  Diagnosis: signature mismatch — sig_type / api_key wrong.');
  } else {
    console.log('  Diagnosis: other — see error above.');
  }
}
