/**
 * Sync CLOB balance allowance + approve USDC to all Polymarket exchange contracts.
 * Run: node scripts/update-balance.mjs
 */
import { createClient } from '/app/node_modules/@supabase/supabase-js/dist/index.mjs';
import { ethers } from '/app/node_modules/ethers/dist/ethers.js';
import crypto from 'crypto';
import https from 'https';

const WALLET_PK = process.env.POLYARB_WALLET_PRIVATE_KEY;
const ENC_KEY   = Buffer.from(process.env.DATA_ENCRYPTION_KEY, 'base64');
const AGENT_ID  = '2cb0642d-c243-41cf-8908-78b619ea923a';

const USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_E      = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';  // USDC.e (bridged) — what CLOB uses
const CONTRACTS   = [
  '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',  // CTF Exchange
  '0xC5d563A36AE78145C45a50134d48A1215220f80a',  // NEG_RISK CTF Exchange
  '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',  // Proxy Wallet
];
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

function decryptText(value) {
  if (!value || !value.startsWith('enc:v1:')) return value;
  const [ivB64, tagB64, dataB64] = value.slice('enc:v1:'.length).split(':');
  const dec = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivB64, 'base64'));
  dec.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([dec.update(Buffer.from(dataB64, 'base64')), dec.final()]).toString('utf8');
}

function clobGet(path, apiKey, apiSecret, apiPassphrase, walletAddress) {
  return new Promise((res) => {
    const ts  = Math.floor(Date.now() / 1000).toString();
    const msg = ts + 'GET' + path.split('?')[0];
    const key = Buffer.from(apiSecret.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const sig = crypto.createHmac('sha256', key).update(msg).digest('base64')
      .replace(/[+]/g, '-').replace(/[/]/g, '_');
    const hdrs = {
      'POLY_ADDRESS': walletAddress.toLowerCase(), 'POLY_SIGNATURE': sig,
      'POLY_TIMESTAMP': ts, 'POLY_API_KEY': apiKey, 'POLY_PASSPHRASE': apiPassphrase,
    };
    https.get('https://clob.polymarket.com' + path, { headers: hdrs }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: d }));
    });
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const { data, error } = await supabase.from('polyarb_agents')
  .select('api_key_encrypted,api_secret_encrypted,api_passphrase_encrypted')
  .eq('id', AGENT_ID).single();
if (error || !data) { console.error('Supabase error:', error); process.exit(1); }

const apiKey        = decryptText(data.api_key_encrypted);
const apiSecret     = decryptText(data.api_secret_encrypted);
const apiPassphrase = decryptText(data.api_passphrase_encrypted);

const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
const pk = WALLET_PK.startsWith('0x') ? WALLET_PK : '0x' + WALLET_PK;
const wallet = new ethers.Wallet(pk, provider);
console.log('Wallet:', wallet.address);

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];
const usdcNative = new ethers.Contract(USDC_NATIVE, ERC20_ABI, wallet);
const usdcE      = new ethers.Contract(USDC_E,      ERC20_ABI, wallet);

const balNative = await usdcNative.balanceOf(wallet.address);
const balE      = await usdcE.balanceOf(wallet.address);
console.log('Native USDC balance:', ethers.formatUnits(balNative, 6), 'USDC');
console.log('USDC.e balance:     ', ethers.formatUnits(balE, 6), 'USDC.e');

// Approve USDC.e (what CLOB uses) to all 3 contracts
console.log('\nApproving USDC.e to Polymarket contracts...');
for (const contract of CONTRACTS) {
  const current = await usdcE.allowance(wallet.address, contract);
  if (current > BigInt('1000000000')) {
    console.log(`USDC.e already approved ${contract.slice(0,10)}... (${ethers.formatUnits(current,6)})`);
    continue;
  }
  console.log(`Approving USDC.e → ${contract.slice(0,10)}...`);
  const tx = await usdcE.approve(contract, MAX_UINT256);
  await tx.wait();
  console.log(`  Approved: ${tx.hash}`);
}

// Call /balance-allowance/update to sync CLOB
const walletAddress = wallet.address;
console.log('\nSyncing CLOB balance...');
const r1 = await clobGet('/balance-allowance/update?asset_type=COLLATERAL&signature_type=0', apiKey, apiSecret, apiPassphrase, walletAddress);
console.log('Update response:', r1.status, r1.body.slice(0, 200));

const r2 = await clobGet('/balance-allowance?asset_type=COLLATERAL&signature_type=0', apiKey, apiSecret, apiPassphrase, walletAddress);
console.log('Balance now:', r2.body.slice(0, 300));
