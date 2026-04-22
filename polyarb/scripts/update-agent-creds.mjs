import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';

const AGENT_ID = '2cb0642d-c243-41cf-8908-78b619ea923a';
const RESULT_FILE = 'scripts/.derive-result.json';

if (!fs.existsSync(RESULT_FILE)) throw new Error(`Run derive-api-key.mjs first (${RESULT_FILE} not found)`);
const { apiKey, secret, passphrase, l2Addr } = JSON.parse(fs.readFileSync(RESULT_FILE, 'utf8'));
console.log(`Loaded credentials — L2 signer will be: ${l2Addr}`);

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATA_ENCRYPTION_KEY'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length > 0) throw new Error(`Missing env vars: ${missing.join(', ')}`);

const encKeyRaw = process.env.DATA_ENCRYPTION_KEY;
const encKey    = encKeyRaw.length === 64
  ? Buffer.from(encKeyRaw, 'hex')
  : Buffer.from(encKeyRaw, 'base64');
if (encKey.length !== 32) throw new Error(`DATA_ENCRYPTION_KEY must decode to 32 bytes, got ${encKey.length}`);

function encryptText(plaintext) {
  const iv      = crypto.randomBytes(16);
  const cipher  = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  let enc = cipher.update(plaintext, 'utf8', 'base64');
  enc    += cipher.final('base64');
  const tag     = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, Buffer.from(enc, 'base64')]);
  return `enc:v1:${combined.toString('base64')}`;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: agent, error: fetchErr } = await supabase
  .from('polyarb_agents')
  .select('id, status')
  .eq('id', AGENT_ID)
  .single();
if (fetchErr || !agent) throw new Error(`Agent not found: ${fetchErr?.message}`);
console.log(`Agent found — status: ${agent.status}`);

const { error: updateErr } = await supabase
  .from('polyarb_agents')
  .update({
    api_key_encrypted:        encryptText(apiKey),
    api_secret_encrypted:     encryptText(secret),
    api_passphrase_encrypted: encryptText(passphrase),
  })
  .eq('id', AGENT_ID);

if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

fs.unlinkSync(RESULT_FILE);
console.log(`\nSupabase updated. ${RESULT_FILE} removed.`);
console.log(`\nNext: npm run build && flyctl deploy -a polyarb-crypto-v1`);
console.log(`Then look for: [order-manager] POLY_PROXY signer ready — L2-signer: ${l2Addr}`);
