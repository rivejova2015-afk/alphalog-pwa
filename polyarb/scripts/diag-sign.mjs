/**
 * Diagnostic: verify EIP-712 signing + POST /order via proxy
 * Run on container: node scripts/diag-sign.mjs
 * Or pipe via: flyctl ssh console -C "node -e '...'"
 */
import { ethers } from '/app/node_modules/ethers/dist/ethers.js';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { createClient } from '/app/node_modules/@supabase/supabase-js/dist/module/index.js';

const CLOB_BASE  = 'https://clob.polymarket.com';
const NEG_RISK   = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const CHAIN_ID   = 137;
const ZERO_ADDR  = '0x0000000000000000000000000000000000000000';

const PK         = process.env.POLYARB_WALLET_PRIVATE_KEY;
const PROXY_URL  = process.env.CLOB_PROXY_URL;
const ENC_KEY    = process.env.DATA_ENCRYPTION_KEY;

if (!PK)        { console.error('POLYARB_WALLET_PRIVATE_KEY missing'); process.exit(1); }
if (!PROXY_URL) { console.error('CLOB_PROXY_URL missing'); process.exit(1); }

const wallet = new ethers.Wallet(PK.startsWith('0x') ? PK : `0x${PK}`);
console.log('Wallet:', wallet.address);

// --- Decrypt helper ---
const encKey = Buffer.from(ENC_KEY, 'base64');
function decryptText(value) {
  if (!value || !value.startsWith('enc:v1:')) return value;
  const [ivB64, tagB64, dataB64] = value.slice('enc:v1:'.length).split(':');
  const dec = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(ivB64, 'base64'));
  dec.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([dec.update(Buffer.from(dataB64, 'base64')), dec.final()]).toString('utf8');
}

// --- Load creds from Supabase ---
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const AGENT_ID = '2cb0642d-c243-41cf-8908-78b619ea923a';
const { data, error } = await supabase.from('polyarb_agents')
  .select('api_key_encrypted,api_secret_encrypted,api_passphrase_encrypted')
  .eq('id', AGENT_ID).single();
if (error || !data) { console.error('Supabase error:', error); process.exit(1); }

const apiKey        = decryptText(data.api_key_encrypted);
const apiSecret     = decryptText(data.api_secret_encrypted);
const apiPassphrase = decryptText(data.api_passphrase_encrypted);
console.log('API key:', apiKey?.slice(0, 8), '...');
console.log('API secret (first 8):', apiSecret?.slice(0, 8), '...');

// --- Proxy fetch ---
const proxyUrl   = new URL(PROXY_URL);
const proxyAgent = new https.Agent(); // fallback — use manual proxy below

async function proxyFetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body   = opts.body || '';
    const options = {
      hostname: proxyUrl.hostname,
      port:     parseInt(proxyUrl.port) || 20000,
      path:     url,
      method:   opts.method || 'GET',
      headers:  {
        'Host':           target.hostname,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Proxy-Authorization': 'Basic ' + Buffer.from(`${proxyUrl.username}:${proxyUrl.password}`).toString('base64'),
        ...(opts.headers || {}),
      },
    };
    // Use HTTPS CONNECT tunnel
    const proxy = http.request({
      hostname: proxyUrl.hostname,
      port:     parseInt(proxyUrl.port) || 20000,
      method:   'CONNECT',
      path:     `${target.hostname}:443`,
      headers: { 'Proxy-Authorization': 'Basic ' + Buffer.from(`${proxyUrl.username}:${proxyUrl.password}`).toString('base64') },
    });
    proxy.on('connect', (res, socket) => {
      const tlsSocket = require('tls').connect({ socket, servername: target.hostname }, () => {
        const req = tlsSocket;
        const lines = [
          `${options.method} ${target.pathname}${target.search} HTTP/1.1`,
          `Host: ${target.hostname}`,
          `Content-Type: application/json`,
          `Content-Length: ${Buffer.byteLength(body)}`,
          ...Object.entries(opts.headers || {}).map(([k,v]) => `${k}: ${v}`),
          '', body,
        ].join('\r\n');
        tlsSocket.write(lines);
        let data = '';
        tlsSocket.on('data', d => data += d);
        tlsSocket.on('end', () => {
          const [head, ...bodyParts] = data.split('\r\n\r\n');
          const status = parseInt(head.split(' ')[1]);
          const text = async () => bodyParts.join('\r\n\r\n');
          const json = async () => JSON.parse(bodyParts.join('\r\n\r\n'));
          resolve({ ok: status >= 200 && status < 300, status, text, json });
        });
      });
    });
    proxy.on('error', reject);
    proxy.end();
  });
}

// --- HMAC auth headers ---
function buildHmacHeaders(method, path, body = '') {
  const ts  = Math.floor(Date.now() / 1000).toString();
  const msg = ts + method.toUpperCase() + path + body;
  const key = Buffer.from(apiSecret, 'base64');
  const sig = crypto.createHmac('sha256', key).update(msg).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_');
  return {
    'POLY_ADDRESS':    wallet.address,
    'POLY_SIGNATURE':  sig,
    'POLY_TIMESTAMP':  ts,
    'POLY_NONCE':      '0',
    'POLY_API_KEY':    apiKey,
    'POLY_PASSPHRASE': apiPassphrase,
  };
}

// --- GET /data/orders to confirm HMAC works ---
console.log('\n--- GET /data/orders ---');
try {
  const r = await fetch(`${CLOB_BASE}/data/orders?maker_address=${wallet.address}`, {
    headers: buildHmacHeaders('GET', `/data/orders?maker_address=${wallet.address}`),
  });
  console.log(`HTTP ${r.status}:`, (await r.text()).slice(0, 100));
} catch(e) { console.error('GET error:', e.message); }

// --- Find a market ---
console.log('\n--- Fetching a btc-updown-5m market ---');
const evRes = await fetch('https://gamma-api.polymarket.com/events?active=true&closed=false&limit=10&tag_slug=bitcoin');
const events = await evRes.json();
const ev = events.find(e => e.slug?.startsWith('btc-updown-5m-'));
if (!ev) { console.error('No market found'); process.exit(1); }
const m = ev.markets[0];
const tokenIds = JSON.parse(m.clobTokenIds);
const tokenId  = tokenIds[0];
console.log('Market:', ev.slug);
console.log('tokenId:', tokenId.slice(0, 20), '...');

// --- Sign order with ethers v6 ---
const DOMAIN = { name: 'Polymarket CTF Exchange', version: '1', chainId: CHAIN_ID, verifyingContract: NEG_RISK };
const ORDER_TYPES = {
  Order: [
    { name: 'salt',          type: 'uint256' },
    { name: 'maker',         type: 'address' },
    { name: 'signer',        type: 'address' },
    { name: 'taker',         type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'makerAmount',   type: 'uint256' },
    { name: 'takerAmount',   type: 'uint256' },
    { name: 'expiration',    type: 'uint256' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'feeRateBps',    type: 'uint256' },
    { name: 'side',          type: 'uint8'   },
    { name: 'signatureType', type: 'uint8'   },
  ],
};

// BUY 1 share @ 0.50 (tiny test order)
const price     = 0.50;
const sizeShares = 1;  // 1 share
const makerAmt  = BigInt(Math.round(sizeShares * price * 1e6));  // USDC out (500000 = $0.50)
const takerAmt  = BigInt(Math.round(sizeShares * 1e6));           // shares in (1000000)

const salt = BigInt(Date.now()).toString();
const orderData = {
  salt,
  maker:         wallet.address,
  signer:        wallet.address,
  taker:         ZERO_ADDR,
  tokenId:       BigInt(tokenId).toString(),
  makerAmount:   makerAmt.toString(),
  takerAmount:   takerAmt.toString(),
  expiration:    '0',
  nonce:         '0',
  feeRateBps:    '1000',
  side:          0,   // BUY
  signatureType: 0,   // EOA
};

console.log('\n--- Signing order ---');
console.log('orderData:', JSON.stringify(orderData, null, 2));

const sig = await wallet.signTypedData(DOMAIN, ORDER_TYPES, orderData);
console.log('Signature:', sig.slice(0, 30), '...');

// Verify locally
const recovered = ethers.TypedDataEncoder.recoverAddress(
  ethers.TypedDataEncoder.hashDomain(DOMAIN),
  ORDER_TYPES,
  orderData,
  sig,
).catch(() => 'RECOVER_FAILED');
// Actually use verifyTypedData
const recoveredAddr = ethers.verifyTypedData(DOMAIN, ORDER_TYPES, orderData, sig);
console.log('Recovered signer:', recoveredAddr);
console.log('Expected:', wallet.address);
console.log('Match:', recoveredAddr.toLowerCase() === wallet.address.toLowerCase());

// --- POST /order ---
const body = JSON.stringify({
  deferExec: false,
  order: {
    ...orderData,
    salt:          parseInt(salt),
    side:          'BUY',
    signature:     sig,
  },
  owner:     apiKey,
  orderType: 'GTC',
});

console.log('\n--- POST /order (direct, no proxy) ---');
try {
  const r = await fetch(`${CLOB_BASE}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...buildHmacHeaders('POST', '/order', body) },
    body,
  });
  console.log(`HTTP ${r.status}:`, (await r.text()).slice(0, 300));
} catch(e) { console.error('POST error:', e.message); }
