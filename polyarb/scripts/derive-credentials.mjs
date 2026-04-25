/**
 * Derive Polymarket API credentials using EIP-712 L1 auth.
 * Checks BOTH the EOA direct account and the proxy account.
 *
 * Run: node polyarb/scripts/derive-credentials.mjs <private_key>
 */
import { ethers } from 'ethers';

const PRIVATE_KEY = process.env.POLYARB_WALLET_PRIVATE_KEY ?? process.argv[2];
if (!PRIVATE_KEY) { console.error('Usage: node derive-credentials.mjs <private_key>'); process.exit(1); }

const PROXY_ADDRESS = '0xD69a020ABB54fBba7f98Cc20C06ac25e4EDfB208';
const CLOB_BASE = 'https://clob.polymarket.com';

const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const wallet = new ethers.Wallet(pk);
console.log(`EOA: ${wallet.address}`);
console.log(`Proxy: ${PROXY_ADDRESS}\n`);

async function buildL1Headers(signerAddress) {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = 0;

  const domain = { name: 'ClobAuthDomain', version: '1', chainId: 137 };
  const types  = {
    ClobAuth: [
      { name: 'address',   type: 'address' },
      { name: 'timestamp', type: 'string'  },
      { name: 'nonce',     type: 'uint256' },
      { name: 'message',   type: 'string'  },
    ],
  };
  const value = {
    address:   signerAddress,
    timestamp: `${ts}`,
    nonce,
    message:   'This message attests that I control the given wallet',
  };

  const sig = await wallet.signTypedData(domain, types, value);
  return {
    POLY_ADDRESS:   signerAddress,
    POLY_SIGNATURE: sig,
    POLY_TIMESTAMP: `${ts}`,
    POLY_NONCE:     `${nonce}`,
  };
}

async function buildHmacHeaders(apiKey, secret, passphrase, address, method, path) {
  const crypto = await import('crypto');
  const ts = Math.floor(Date.now() / 1000).toString();
  const secretB64 = secret.replace(/-/g, '+').replace(/_/g, '/');
  const sig = crypto.default.createHmac('sha256', Buffer.from(secretB64, 'base64'))
    .update(ts + method + path)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_');
  return {
    POLY_ADDRESS:    address.toLowerCase(),
    POLY_SIGNATURE:  sig,
    POLY_TIMESTAMP:  ts,
    POLY_API_KEY:    apiKey,
    POLY_PASSPHRASE: passphrase,
  };
}

async function deriveAndCheck(label, signerAddress) {
  console.log(`\n=== ${label} ===`);
  const headers = await buildL1Headers(signerAddress);
  console.log(`Headers: ${JSON.stringify(headers)}`);

  // Try POST first (create), fall back to GET (derive existing)
  let res = await fetch(`${CLOB_BASE}/auth/api-key`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  let text = await res.text();
  console.log(`  POST /auth/api-key → ${res.status}: ${text.slice(0, 200)}`);

  if (!res.ok) {
    // Try GET /auth/derive-api-key (derives existing key deterministically)
    const getHeaders = await buildL1Headers(signerAddress);
    res = await fetch(`${CLOB_BASE}/auth/derive-api-key`, {
      method: 'GET',
      headers: getHeaders,
    });
    text = await res.text();
    console.log(`  GET  /auth/derive-api-key → ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.ok) return null;

  const creds = JSON.parse(text);
  const apiKey    = creds.apiKey ?? creds.key;
  const secret    = creds.secret;
  const passphrase = creds.passphrase;

  // Check CLOB balance with these credentials
  const l2h = await buildHmacHeaders(apiKey, secret, passphrase, signerAddress, 'GET', '/balance-allowance');
  const balRes = await fetch(`${CLOB_BASE}/balance-allowance?asset_type=COLLATERAL&signature_type=0`, { headers: l2h });
  const balText = await balRes.text();
  console.log(`  Balance → ${balRes.status}: ${balText}`);

  return { apiKey, secret, passphrase };
}

// 1. Try EOA direct account
const eoCreds = await deriveAndCheck('EOA direct account (0xf2c911...)', wallet.address);

// 2. Try proxy account (sign as EOA but address = proxy)
const proxyCreds = await deriveAndCheck('Proxy account (0xD69a...)', PROXY_ADDRESS);

if (proxyCreds) {
  console.log('\n=== PROXY CREDENTIALS ===');
  console.log(`apiKey:     ${proxyCreds.apiKey}`);
  console.log(`secret:     ${proxyCreds.secret}`);
  console.log(`passphrase: ${proxyCreds.passphrase}`);
}
