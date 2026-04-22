import { ethers } from 'ethers';
import fs from 'fs';

const CLOB_BASE = 'https://clob.polymarket.com';
const RAW_KEY   = process.env.POLYARB_WALLET_PRIVATE_KEY;
const NONCE     = Number(process.argv[2] ?? '0');

if (!RAW_KEY) throw new Error('POLYARB_WALLET_PRIVATE_KEY not set');
if (!/^(0x)?[0-9a-fA-F]{64}$/.test(RAW_KEY)) throw new Error('Invalid private key (must be 64 hex chars)');

const wallet = new ethers.Wallet(RAW_KEY.startsWith('0x') ? RAW_KEY : `0x${RAW_KEY}`);
const EXPECTED = '0xf2c911888d825B793F93D1Eff111f1fdd2306463';
if (wallet.address.toLowerCase() !== EXPECTED.toLowerCase()) {
  throw new Error(`Wallet mismatch — got ${wallet.address}, expected ${EXPECTED}`);
}
console.log(`Wallet: ${wallet.address}  nonce=${NONCE}`);

const ts     = Math.floor(Date.now() / 1000);
const domain = { name: 'ClobAuthDomain', version: '1', chainId: 137 };
const types  = { ClobAuth: [
  { name: 'address',   type: 'address' },
  { name: 'timestamp', type: 'string'  },
  { name: 'nonce',     type: 'uint256' },
  { name: 'message',   type: 'string'  },
]};
const value = {
  address:   wallet.address,
  timestamp: ts.toString(),
  nonce:     NONCE,
  message:   'This message attests that I control the given wallet',
};

const sig = await wallet.signTypedData(domain, types, value);
console.log('Signature created — calling CLOB...');

const res  = await fetch(`${CLOB_BASE}/auth/derive-api-key`, {
  method:  'GET',
  headers: {
    'POLY_ADDRESS':   wallet.address,
    'POLY_SIGNATURE': sig,
    'POLY_TIMESTAMP': ts.toString(),
    'POLY_NONCE':     String(NONCE),
  },
});

const body = await res.text();
console.log(`HTTP ${res.status}:`, body.slice(0, 300));

if (res.status !== 200) {
  if (body.includes('nonce')) {
    console.error(`\nHint: try nonce ${NONCE + 1}  →  node scripts/derive-api-key.mjs ${NONCE + 1}`);
  }
  process.exit(1);
}

const json = JSON.parse(body);
const { apiKey, secret, passphrase } = json;
if (!apiKey || !secret || !passphrase) throw new Error(`Missing fields: ${JSON.stringify(json)}`);

// Derive and show the L2 signer address
const stripped = secret.replace(/-/g, '+').replace(/_/g, '/');
const hexKey   = `0x${Buffer.from(stripped, 'base64').toString('hex')}`;
const l2Addr   = new ethers.Wallet(hexKey).address;

console.log('\n=== DERIVED CREDENTIALS ===');
console.log(`apiKey:     ${apiKey}`);
console.log(`secret:     ${secret}`);
console.log(`passphrase: ${passphrase}`);
console.log(`L2 signer:  ${l2Addr}  ← must appear in Fly.io logs after redeploy`);

fs.writeFileSync('scripts/.derive-result.json', JSON.stringify({ apiKey, secret, passphrase, l2Addr }, null, 2));
console.log('\nSaved to scripts/.derive-result.json');
