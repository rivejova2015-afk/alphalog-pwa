/**
 * Recreate Polymarket api_key in EOA mode (signature_type=0)
 * for the polyarb-50x agent, then update polyarb_agents row in Supabase.
 *
 * Why: the current api_key is bound to a Polymarket proxy address that
 * holds no funds. Switching to an EOA-bound api_key lets the bot trade
 * directly from 0xf2c911..., which already has USDC.e + 5 spender
 * allowances at MAX.
 *
 * Required env (load before running):
 *   POLYARB_WALLET_PRIVATE_KEY   wallet private key (64 hex, 0x optional)
 *   POLYARB_AGENT_ID             target row in polyarb_agents
 *   NEXT_PUBLIC_SUPABASE_URL     supabase project url
 *   SUPABASE_SERVICE_ROLE_KEY    service role key (writes polyarb_agents)
 *   DATA_ENCRYPTION_KEY          32-byte AES key, base64-encoded
 *
 * Optional:
 *   argv[2]                      EIP-712 nonce (default 0). Bump if collision.
 *
 * Run:
 *   node polyarb/scripts/recreate-eoa-key.mjs
 *
 * After success:
 *   flyctl apps restart polyarb-50x
 *   flyctl logs -a polyarb-50x | grep -i balance
 *   Expected: "[500x] CLOB balance: $12.XX USDC" (was $0 before)
 */

import { ethers } from 'ethers';
import crypto from 'node:crypto';

const CLOB_BASE = 'https://clob.polymarket.com';

// ---------- env ----------
const PRIVATE_KEY  = process.env.POLYARB_WALLET_PRIVATE_KEY;
const AGENT_ID     = process.env.POLYARB_AGENT_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_KEY_RAW = process.env.DATA_ENCRYPTION_KEY;
const NONCE        = Number(process.argv[2] ?? '0');

const required = { POLYARB_WALLET_PRIVATE_KEY: PRIVATE_KEY, POLYARB_AGENT_ID: AGENT_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE, DATA_ENCRYPTION_KEY: DATA_KEY_RAW };
const missing  = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length > 0) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

const dataKey = Buffer.from(DATA_KEY_RAW, 'base64');
if (dataKey.length !== 32) {
  console.error(`DATA_ENCRYPTION_KEY must decode to 32 bytes, got ${dataKey.length}`);
  process.exit(1);
}

// ---------- 1. Derive EOA wallet ----------
const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const wallet = new ethers.Wallet(pk);
const expected = '0xf2c911888d825B793F93D1Eff111f1fdd2306463';
if (wallet.address.toLowerCase() !== expected.toLowerCase()) {
  console.error(`Wallet mismatch — got ${wallet.address}, expected ${expected}`);
  process.exit(1);
}
console.log(`EOA:    ${wallet.address}`);
console.log(`Agent:  ${AGENT_ID}`);
console.log(`Nonce:  ${NONCE}`);

// ---------- 2. EIP-712 L1 signature ----------
const ts = Math.floor(Date.now() / 1000).toString();
const domain = { name: 'ClobAuthDomain', version: '1', chainId: 137 };
const types  = { ClobAuth: [
  { name: 'address',   type: 'address' },
  { name: 'timestamp', type: 'string'  },
  { name: 'nonce',     type: 'uint256' },
  { name: 'message',   type: 'string'  },
]};
const value = {
  address:   wallet.address,
  timestamp: ts,
  nonce:     NONCE,
  message:   'This message attests that I control the given wallet',
};
const sig = await wallet.signTypedData(domain, types, value);
const l1Headers = {
  POLY_ADDRESS:   wallet.address,
  POLY_SIGNATURE: sig,
  POLY_TIMESTAMP: ts,
  POLY_NONCE:     String(NONCE),
};

// ---------- 3. Create or derive api_key ----------
console.log('\n[1/4] POST /auth/api-key (create new)...');
let res = await fetch(`${CLOB_BASE}/auth/api-key`, {
  method:  'POST',
  headers: { ...l1Headers, 'Content-Type': 'application/json' },
});
let bodyText = await res.text();
console.log(`      HTTP ${res.status}: ${bodyText.slice(0, 200)}`);

if (!res.ok) {
  console.log('\n[1/4] GET /auth/derive-api-key (deterministic derive)...');
  res = await fetch(`${CLOB_BASE}/auth/derive-api-key`, {
    method:  'GET',
    headers: l1Headers,
  });
  bodyText = await res.text();
  console.log(`      HTTP ${res.status}: ${bodyText.slice(0, 200)}`);
}
if (!res.ok) {
  console.error('\nBoth endpoints failed. Try: node polyarb/scripts/recreate-eoa-key.mjs ' + (NONCE + 1));
  process.exit(1);
}

const creds       = JSON.parse(bodyText);
const apiKey      = creds.apiKey ?? creds.api_key ?? creds.key;
const apiSecret   = creds.secret ?? creds.apiSecret;
const passphrase  = creds.passphrase ?? creds.apiPassphrase;
if (!apiKey || !apiSecret || !passphrase) {
  console.error('Missing fields in response:', creds);
  process.exit(1);
}
console.log(`      apiKey=${apiKey.slice(0, 8)}... secret=${apiSecret.slice(0, 8)}... passphrase=${passphrase.slice(0, 8)}...`);

// ---------- 4. Verify creds against /balance-allowance (signature_type=0) ----------
console.log('\n[2/4] Verifying creds — GET /balance-allowance?signature_type=0 ...');
const verifyTs  = Math.floor(Date.now() / 1000).toString();
const secretB64 = apiSecret.replace(/-/g, '+').replace(/_/g, '/');
const hmacSig   = crypto.createHmac('sha256', Buffer.from(secretB64, 'base64'))
  .update(verifyTs + 'GET' + '/balance-allowance')
  .digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_');

const balRes = await fetch(
  `${CLOB_BASE}/balance-allowance?asset_type=COLLATERAL&signature_type=0`,
  { headers: {
    POLY_ADDRESS:    wallet.address.toLowerCase(),
    POLY_SIGNATURE:  hmacSig,
    POLY_TIMESTAMP:  verifyTs,
    POLY_API_KEY:    apiKey,
    POLY_PASSPHRASE: passphrase,
  }},
);
const balText = await balRes.text();
console.log(`      HTTP ${balRes.status}: ${balText}`);

if (!balRes.ok) {
  console.error('\nCreds rejected by CLOB. Aborting Supabase update.');
  process.exit(1);
}

let parsedBal;
try { parsedBal = JSON.parse(balText); } catch { parsedBal = {}; }
const balanceWei = String(parsedBal.balance ?? '0');
const balanceUsd = Number(balanceWei) / 1e6;
console.log(`      EOA CLOB balance: $${balanceUsd.toFixed(4)} USDC`);
if (balanceUsd === 0) {
  console.warn('\n      ⚠ Balance is 0. Creds work but CLOB sees no funds for the EOA.');
  console.warn('        Continuing — verify after deploy. If still 0, check on-chain USDC.e holdings.');
}

// ---------- 5. Encrypt (matches polyarb/src/crypto/encryption.ts) ----------
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

// ---------- 6. Update polyarb_agents ----------
console.log('\n[3/4] Updating polyarb_agents row...');
const updateRes = await fetch(
  `${SUPABASE_URL}/rest/v1/polyarb_agents?id=eq.${AGENT_ID}`,
  {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'Prefer':        'return=representation',
    },
    body: JSON.stringify({
      api_key_encrypted:        encrypt(apiKey),
      api_secret_encrypted:     encrypt(apiSecret),
      api_passphrase_encrypted: encrypt(passphrase),
      wallet_address:           wallet.address,
    }),
  },
);
const updateBody = await updateRes.text();
if (!updateRes.ok) {
  console.error('Supabase update failed:', updateRes.status, updateBody);
  process.exit(1);
}
console.log('      ✓ row updated');

// ---------- 7. Done ----------
console.log('\n[4/4] Next steps:');
console.log('      flyctl apps restart polyarb-50x');
console.log('      flyctl logs -a polyarb-50x | grep -i "CLOB balance"');
console.log(`      Expected: "[500x] CLOB balance: $${balanceUsd.toFixed(2)} USDC" (was $0)`);
