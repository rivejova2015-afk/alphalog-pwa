import { ethers } from 'ethers';
import crypto from 'node:crypto';

const WALLET_KEY = process.env.WALLET_KEY;
const DATA_KEY = process.env.DATA_ENCRYPTION_KEY;

if (!WALLET_KEY || !DATA_KEY) {
  console.error('Missing WALLET_KEY or DATA_ENCRYPTION_KEY');
  process.exit(1);
}

const wallet = new ethers.Wallet(WALLET_KEY.startsWith('0x') ? WALLET_KEY : '0x' + WALLET_KEY);
console.log('Wallet address:', wallet.address);

const DOMAIN = { name: 'ClobAuthDomain', version: '1', chainId: 137 };
const TYPES = {
  ClobAuth: [
    { name: 'address',   type: 'address' },
    { name: 'timestamp', type: 'string'  },
    { name: 'nonce',     type: 'uint256' },
    { name: 'message',   type: 'string'  },
  ],
};

const timestamp = Math.floor(Date.now() / 1000).toString();
const msg = {
  address: wallet.address,
  timestamp,
  nonce: '0',
  message: 'This message attests that I control the given wallet',
};

const sig = await wallet.signTypedData(DOMAIN, TYPES, msg);
console.log('L1 signature ready, length:', sig.length);

const tryEndpoint = async (path) => {
  const res = await fetch('https://clob.polymarket.com' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'POLY_ADDRESS':   wallet.address,
      'POLY_SIGNATURE': sig,
      'POLY_TIMESTAMP': timestamp,
      'POLY_NONCE':     '0',
    },
  });
  const text = await res.text();
  return { status: res.status, text };
};

console.log('\n--- Trying /auth/api-key/create ---');
let r = await tryEndpoint('/auth/api-key/create');
console.log('status:', r.status, 'body:', r.text.slice(0, 300));

if (r.status !== 200 && r.status !== 201) {
  console.log('\n--- Trying /auth/api-key (derive) ---');
  r = await tryEndpoint('/auth/api-key');
  console.log('status:', r.status, 'body:', r.text.slice(0, 300));
}

if (r.status !== 200 && r.status !== 201) {
  console.log('\n--- Trying /auth/derive-api-key ---');
  r = await tryEndpoint('/auth/derive-api-key');
  console.log('status:', r.status, 'body:', r.text.slice(0, 300));
}

if (r.status !== 200 && r.status !== 201) {
  console.error('\nAll endpoints failed.');
  process.exit(1);
}

const creds = JSON.parse(r.text);
console.log('\nKeys in response:', Object.keys(creds));

const keyBuffer = Buffer.from(DATA_KEY, 'base64');
if (keyBuffer.length !== 32) {
  console.error('DATA_ENCRYPTION_KEY must be 32 bytes, got', keyBuffer.length);
  process.exit(1);
}

const enc = (val) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:v1:' + iv.toString('base64') + ':' + tag.toString('base64') + ':' + encrypted.toString('base64');
};

const apiKey = creds.apiKey ?? creds.api_key ?? creds.key;
const apiSecret = creds.secret ?? creds.apiSecret ?? creds.api_secret;
const apiPassphrase = creds.passphrase ?? creds.apiPassphrase ?? creds.api_passphrase;

if (!apiKey || !apiSecret || !apiPassphrase) {
  console.error('Could not extract apiKey/secret/passphrase from response:', creds);
  process.exit(1);
}

console.log('\nEncrypting credentials...');
const out = {
  api_key_encrypted:        enc(apiKey),
  api_secret_encrypted:     enc(apiSecret),
  api_passphrase_encrypted: enc(apiPassphrase),
};

console.log('\n=== READY TO WRITE TO SUPABASE ===');
console.log('api_key_encrypted:       ', out.api_key_encrypted);
console.log('api_secret_encrypted:    ', out.api_secret_encrypted);
console.log('api_passphrase_encrypted:', out.api_passphrase_encrypted);
console.log('\napi_key (plain, for debug):', apiKey);
