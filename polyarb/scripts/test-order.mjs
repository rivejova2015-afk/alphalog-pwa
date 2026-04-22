/**
 * Diagnostic: place a tiny test order using official @polymarket/clob-client
 * to verify credentials and signing work end-to-end.
 *
 * Usage (on Fly.io): flyctl ssh console -C "node scripts/test-order.mjs"
 * Usage (local): POLYARB_WALLET_PRIVATE_KEY=... DATA_ENCRYPTION_KEY=... node scripts/test-order.mjs
 */
import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const AGENT_ID = '2cb0642d-c243-41cf-8908-78b619ea923a';
const CLOB_BASE = 'https://clob.polymarket.com';

// --- decrypt helper ---
const encKey = Buffer.from(process.env.DATA_ENCRYPTION_KEY, 'base64');
function decryptText(value) {
  if (!value || !value.startsWith('enc:v1:')) return value;
  const parts = value.slice('enc:v1:'.length).split(':');
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  const iv  = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const dat = Buffer.from(dataB64, 'base64');
  const dec = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(dat), dec.final()]).toString('utf8');
}

// --- load creds from Supabase ---
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('polyarb_agents').select('api_key_encrypted,api_secret_encrypted,api_passphrase_encrypted,wallet_address').eq('id', AGENT_ID).single();
if (error || !data) { console.error('Agent fetch failed:', error); process.exit(1); }

const apiKey        = decryptText(data.api_key_encrypted);
const apiSecret     = decryptText(data.api_secret_encrypted);
const apiPassphrase = decryptText(data.api_passphrase_encrypted);
const rawKey = process.env.POLYARB_WALLET_PRIVATE_KEY;
const wallet = new ethers.Wallet(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`);

console.log('=== Credentials ===');
console.log('apiKey:', apiKey);
console.log('walletAddress:', wallet.address);
console.log('apiSecret (first 10):', apiSecret?.slice(0, 10));

// --- verify api-key via /auth/api-keys ---
const ts  = Math.floor(Date.now() / 1000);
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
  nonce:     0,
  message:   'This message attests that I control the given wallet',
};
const sig = await wallet.signTypedData(domain, types, value);
const authRes = await fetch(`${CLOB_BASE}/auth/api-keys`, {
  headers: {
    'POLY_ADDRESS':   wallet.address,
    'POLY_SIGNATURE': sig,
    'POLY_TIMESTAMP': ts.toString(),
    'POLY_NONCE':     '0',
  }
});
const authBody = await authRes.text();
console.log('\n=== /auth/api-keys ===');
console.log(`HTTP ${authRes.status}:`, authBody.slice(0, 300));

// --- use official ClobClient to create and sign an order ---
// Pick a known active btc-updown-5m market token
const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const evRes = await fetch(`${GAMMA_BASE}/events?active=true&closed=false&limit=5&tag_slug=bitcoin`);
const evData = await evRes.json();
const ev = evData.find(e => e.slug?.startsWith('btc-updown-5m-'));
if (!ev || !ev.markets?.[0]) { console.error('No btc-updown-5m market found'); process.exit(1); }

const m = ev.markets[0];
const tokenIds = JSON.parse(m.clobTokenIds);
const tokenId  = tokenIds[0];  // YES/Up token
console.log('\n=== Market ===');
console.log('slug:', ev.slug);
console.log('conditionId:', m.conditionId);
console.log('tokenId:', tokenId);

// Build signed order using official client
const clobClient = new ClobClient(CLOB_BASE, 137, wallet, {
  key: apiKey,
  secret: apiSecret,
  passphrase: apiPassphrase,
}, 0 /* EOA */);

try {
  const order = await clobClient.createOrder({
    tokenID: tokenId,
    price: 0.5,
    side: 'BUY',
    size: 1,  // 1 share
    feeRateBps: 1000,
  }, {
    tickSize: '0.01',
    negRisk: true,
  });
  console.log('\n=== Signed order (official client) ===');
  console.log('maker:', order.maker);
  console.log('signer:', order.signer);
  console.log('signatureType:', order.signatureType);
  console.log('makerAmount:', order.makerAmount);
  console.log('takerAmount:', order.takerAmount);
  console.log('sig prefix:', order.signature.slice(0, 20));
} catch(e) {
  console.error('createOrder error:', e.message);
}
