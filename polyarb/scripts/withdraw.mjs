/**
 * Withdraw CLOB balance from Polymarket EOA account to on-chain wallet.
 *
 * The Polymarket Exchange contract (0x4bFb...) holds the deposited USDC.
 * This script calls the contract's withdraw function to move USDC back
 * to the EOA wallet on Polygon.
 *
 * Run: node polyarb/scripts/withdraw.mjs [amount_usd]
 * Example: node polyarb/scripts/withdraw.mjs 0.55   (withdraw $0.55)
 *          node polyarb/scripts/withdraw.mjs         (withdraw full balance)
 */
import { ethers } from 'ethers';

const PRIVATE_KEY     = process.env.POLYARB_WALLET_PRIVATE_KEY ?? process.argv[2];
const AMOUNT_ARG      = process.argv[3]; // optional USD amount, e.g. "0.55"

if (!PRIVATE_KEY) { console.error('Set POLYARB_WALLET_PRIVATE_KEY env var'); process.exit(1); }

// Polymarket contract addresses on Polygon
const EXCHANGE        = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'; // CLOB Exchange (holds deposited USDC)
const USDC_NATIVE     = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_E          = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const PUSD            = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB';
const POLYGON_RPC     = process.env.POLYGON_RPC_URL ?? 'https://polygon.api.onfinality.io/public';

// CLOB credentials for EOA
const API_KEY    = '1f508cec-84ab-afd8-2547-805adbc32ac0';
const API_SECRET = 'henlgyyft8jIzSUtjUkCsGWnzMb-K8KjM0g3WmJjUlg=';
const API_PASS   = '1dea4f3271ffc9a3d3dc7afc987d8081a7b006882c8edd3e1e6030ceba727615';

const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const provider = new ethers.JsonRpcProvider(POLYGON_RPC, 137, { staticNetwork: ethers.Network.from(137) });
const wallet = new ethers.Wallet(pk, provider);
console.log(`Wallet: ${wallet.address}`);

// 1. Check CLOB balance via API
import crypto from 'crypto';
const ts = Math.floor(Date.now() / 1000).toString();
const secretB64 = API_SECRET.replace(/-/g, '+').replace(/_/g, '/');
const sig = crypto.createHmac('sha256', Buffer.from(secretB64, 'base64'))
  .update(ts + 'GET' + '/balance-allowance').digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_');

const balRes = await fetch('https://clob.polymarket.com/balance-allowance?asset_type=COLLATERAL&signature_type=0', {
  headers: { POLY_ADDRESS: wallet.address.toLowerCase(), POLY_SIGNATURE: sig, POLY_TIMESTAMP: ts, POLY_API_KEY: API_KEY, POLY_PASSPHRASE: API_PASS }
});
const balJson = await balRes.json();
const clobBalanceMicro = BigInt(balJson.balance ?? '0');
const clobBalanceUsd = Number(clobBalanceMicro) / 1e6;
console.log(`\nCLOB balance: $${clobBalanceUsd.toFixed(6)} USDC (${clobBalanceMicro} micro)`);

if (clobBalanceMicro === 0n) {
  console.log('Nothing to withdraw.'); process.exit(0);
}

// 2. Check on-chain USDC balances
const erc20 = ['function balanceOf(address) view returns (uint256)'];
const [bPusd, bUsdc, bUsdce] = await Promise.all([
  new ethers.Contract(PUSD,        erc20, provider).balanceOf(wallet.address),
  new ethers.Contract(USDC_NATIVE, erc20, provider).balanceOf(wallet.address),
  new ethers.Contract(USDC_E,      erc20, provider).balanceOf(wallet.address),
]);
console.log(`On-chain:     pUSD=$${(Number(bPusd)/1e6).toFixed(4)} USDC=$${(Number(bUsdc)/1e6).toFixed(4)} USDC.e=$${(Number(bUsdce)/1e6).toFixed(4)}`);

// 3. Try withdraw via Exchange contract
// Probe selectors to find the correct withdraw function
const EXCHANGE_ABI = [
  'function withdraw(uint256 amount) external',              // selector 2e1a7d4d
  'function withdrawTo(address to, uint256 amount) external',// selector 205c2878
  'function withdrawAll() external',                         // selector 853828b6
];

const amountMicro = AMOUNT_ARG
  ? BigInt(Math.round(parseFloat(AMOUNT_ARG) * 1e6))
  : clobBalanceMicro;

console.log(`\nAttempting to withdraw $${(Number(amountMicro)/1e6).toFixed(6)} USDC...`);

const exchange = new ethers.Contract(EXCHANGE, EXCHANGE_ABI, wallet);
let success = false;

for (const fn of ['withdraw', 'withdrawTo', 'withdrawAll']) {
  try {
    let tx;
    if (fn === 'withdraw') {
      tx = await exchange.withdraw(amountMicro, { gasLimit: 200_000 });
    } else if (fn === 'withdrawTo') {
      tx = await exchange.withdrawTo(wallet.address, amountMicro, { gasLimit: 200_000 });
    } else {
      tx = await exchange.withdrawAll({ gasLimit: 200_000 });
    }
    console.log(`${fn}() tx sent: ${tx.hash}`);
    const receipt = await tx.wait(1);
    console.log(`✓ Confirmed! Status=${receipt?.status}`);
    success = true;
    break;
  } catch (e) {
    console.log(`${fn}() failed: ${e.message.slice(0, 100)}`);
  }
}

if (!success) {
  console.log('\n⚠ No withdraw function worked on the Exchange contract.');
  console.log('The CLOB balance may be withdrawable only via polymarket.com UI.');
  console.log('Try connecting the EOA wallet directly to polymarket.com/profile.');
}
