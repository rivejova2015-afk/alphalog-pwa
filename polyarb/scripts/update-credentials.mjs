/**
 * Update polyarb_agents credentials in Supabase.
 *
 * Requires the service-role key in env (NEVER hardcode — it bypasses RLS):
 *
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # PowerShell
 *   $env:POLY_API_KEY="your-api-key"
 *   $env:POLY_SECRET="your-secret"
 *   $env:POLY_PASSPHRASE="your-passphrase"
 *   node polyarb/scripts/update-credentials.mjs
 *
 * Or on bash:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... POLY_API_KEY=... POLY_SECRET=... \
 *     POLY_PASSPHRASE=... node polyarb/scripts/update-credentials.mjs
 */

const SUPABASE_URL = 'https://jgkvnnlodwdtjsmmzwry.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set.');
  console.error('   Get it from Supabase Dashboard → Settings → API → service_role');
  console.error('   Then re-run with the env var set.');
  process.exit(1);
}

const AGENT_ID = '2cb0642d-c243-41cf-8908-78b619ea923a';
// Proxy wallet (stays unchanged)
const WALLET_ADDRESS = '0xD69a020ABB54fBba7f98Cc20C06ac25e4EDfB208';

const apiKey      = process.env.POLY_API_KEY;
const apiSecret   = process.env.POLY_SECRET;
const passphrase  = process.env.POLY_PASSPHRASE;

if (!apiKey || !apiSecret || !passphrase) {
  console.error('Set environment variables first:');
  console.error('  $env:POLY_API_KEY="..."');
  console.error('  $env:POLY_SECRET="..."');
  console.error('  $env:POLY_PASSPHRASE="..."');
  process.exit(1);
}

console.log(`Updating agent ${AGENT_ID}...`);
console.log(`  apiKey:       ${apiKey.slice(0, 8)}...`);
console.log(`  secret:       ${apiSecret.slice(0, 8)}...`);
console.log(`  passphrase:   ${passphrase.slice(0, 8)}...`);
console.log(`  walletAddress: ${WALLET_ADDRESS}`);

// First verify the credentials against CLOB
const crypto = await import('crypto');
const ts = Math.floor(Date.now() / 1000).toString();
const secretB64 = apiSecret.replace(/-/g, '+').replace(/_/g, '/');
const hmacSig = crypto.default.createHmac('sha256', Buffer.from(secretB64, 'base64'))
  .update(ts + 'GET' + '/balance-allowance')
  .digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_');

const testRes = await fetch('https://clob.polymarket.com/balance-allowance?asset_type=COLLATERAL&signature_type=0', {
  headers: {
    POLY_ADDRESS:    WALLET_ADDRESS.toLowerCase(),
    POLY_SIGNATURE:  hmacSig,
    POLY_TIMESTAMP:  ts,
    POLY_API_KEY:    apiKey,
    POLY_PASSPHRASE: passphrase,
  },
});
const testBody = await testRes.text();
console.log(`\nCLOB balance check: HTTP ${testRes.status} → ${testBody.slice(0, 200)}`);

if (!testRes.ok) {
  console.error('\n❌ Credentials rejected by CLOB — aborting Supabase update.');
  process.exit(1);
}

console.log('\n✓ Credentials verified! Updating Supabase...');

// Update Supabase
const updateRes = await fetch(
  `${SUPABASE_URL}/rest/v1/polyarb_agents?id=eq.${AGENT_ID}`,
  {
    method: 'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'Prefer':        'return=representation',
    },
    body: JSON.stringify({
      api_key_encrypted:        apiKey,
      api_secret_encrypted:     apiSecret,
      api_passphrase_encrypted: passphrase,
      wallet_address:           WALLET_ADDRESS,
    }),
  }
);
const updateBody = await updateRes.text();
if (updateRes.ok) {
  console.log('✓ Supabase updated successfully.');
  console.log('  Restart the bot on Fly.io: fly app restart polyarb-v1');
} else {
  console.error('❌ Supabase update failed:', updateRes.status, updateBody);
  process.exit(1);
}
