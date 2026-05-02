/**
 * Force-run ensureAllowances on prod.
 * Invokes the same code path the bot startup uses, so we capture the same errors.
 */
import { OrderManager } from '/app/dist/trading/order-manager.js';

const RAW_KEY    = process.env.POLYARB_WALLET_PRIVATE_KEY;
const API_KEY    = '1f508cec-84ab-afd8-2547-805adbc32ac0';
const API_SECRET = 'henlgyyft8jIzSUtjUkCsGWnzMb-K8KjM0g3WmJjUlg=';
const PASSPHRASE = '1dea4f3271ffc9a3d3dc7afc987d8081a7b006882c8edd3e1e6030ceba727615';

if (!RAW_KEY) { console.error('POLYARB_WALLET_PRIVATE_KEY missing'); process.exit(1); }
const pk = RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`;

const om = new OrderManager(API_KEY, API_SECRET, PASSPHRASE, pk, false, null);

console.log('Calling ensureAllowances...');
try {
  await om.ensureAllowances();
  console.log('Done.');
} catch (e) {
  console.error('ensureAllowances threw:', e?.message ?? e);
  console.error('stack:', e?.stack?.split('\n').slice(0, 5).join('\n'));
}
