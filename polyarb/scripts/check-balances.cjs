/**
 * Checks CLOB balance for BOTH the EOA direct account and the proxy account.
 * Uses @polymarket/clob-client with L1 auth to derive/create credentials.
 *
 * Run: node polyarb/scripts/check-balances.cjs ec33d237...
 */
const { ClobClient } = require('@polymarket/clob-client');
const { Wallet } = require('@ethersproject/wallet');

const PRIVATE_KEY = process.env.POLYARB_WALLET_PRIVATE_KEY ?? process.argv[2];
if (!PRIVATE_KEY) { console.error('Pass private key as argument'); process.exit(1); }

const PROXY_ADDRESS = '0xD69a020ABB54fBba7f98Cc20C06ac25e4EDfB208';
const HOST = 'https://clob.polymarket.com';
const CHAIN = 137; // Polygon

const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const signer = new Wallet(pk);
console.log(`EOA signer: ${signer.address}`);
console.log(`Proxy:      ${PROXY_ADDRESS}\n`);

async function checkAccount(label, funder) {
  console.log(`=== ${label} ===`);
  try {
    // signatureType=0 = Browser wallet (MetaMask)
    const client = funder
      ? new ClobClient(HOST, CHAIN, signer, undefined, 0, funder)
      : new ClobClient(HOST, CHAIN, signer);

    const creds = await client.createOrDeriveApiKey();
    console.log(`  apiKey: ${creds.key}`);

    // Now use L2 creds to check balance
    const { ClobClient: ClobClient2 } = require('@polymarket/clob-client');
    const authedClient = funder
      ? new ClobClient2(HOST, CHAIN, signer, creds, 0, funder)
      : new ClobClient2(HOST, CHAIN, signer, creds, 0);

    const bal = await authedClient.getBalanceAllowance({ asset_type: 'COLLATERAL' });
    console.log(`  CLOB balance: ${JSON.stringify(bal)}`);
    return creds;
  } catch (e) {
    console.error(`  Error: ${e.message}`);
    return null;
  }
}

(async () => {
  // 1. EOA direct account (no funder)
  await checkAccount('EOA direct account (0xf2c911...)', null);

  // 2. Proxy account (funder = proxy address)
  const proxyCreds = await checkAccount('Proxy account (0xD69a...)', PROXY_ADDRESS);

  if (proxyCreds) {
    console.log('\n=== PROXY CREDENTIALS (save these) ===');
    console.log(`  key:        ${proxyCreds.key}`);
    console.log(`  secret:     ${proxyCreds.secret}`);
    console.log(`  passphrase: ${proxyCreds.passphrase}`);
  }
})();
