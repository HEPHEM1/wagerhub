import {
  Client,
  PrivateKey,
  AccountId,
  TokenMintTransaction,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPERATOR_ID  = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;

// Existing stablecoin Token IDs on Hedera Testnet
const USDC_TOKEN_ID = "0.0.9388818";
const USDT_TOKEN_ID = "0.0.9388816";

// Mint 50,000 more of each (6 decimals)
const MINT_AMOUNT_UNITS = 50_000n;
const DECIMALS = 6n;
const RAW_MINT_AMOUNT = MINT_AMOUNT_UNITS * (10n ** DECIMALS);

async function mintToken(client, parsedKey, tokenId, symbol) {
  console.log(`Minting ${MINT_AMOUNT_UNITS} ${symbol} (${tokenId})...`);

  const tx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(RAW_MINT_AMOUNT)
    .freezeWith(client)
    .sign(parsedKey);

  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  
  console.log(`   ✅ Minted successfully! New Total Supply: ${receipt.totalSupply}`);
}

async function main() {
  if (!OPERATOR_ID || !OPERATOR_KEY) {
    throw new Error('Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY in .env.local');
  }

  const parsedKey = OPERATOR_KEY.startsWith('0x')
    ? PrivateKey.fromStringECDSA(OPERATOR_KEY)
    : PrivateKey.fromString(OPERATOR_KEY);

  const client = Client.forTestnet().setOperator(AccountId.fromString(OPERATOR_ID), parsedKey);

  console.log('=== Minting more Mock Stablecoins to Deployer Treasury ===\n');

  try {
    await mintToken(client, parsedKey, USDC_TOKEN_ID, 'USDC');
  } catch (e) {
    console.error(`❌ Failed to mint USDC:`, e.message);
  }

  try {
    await mintToken(client, parsedKey, USDT_TOKEN_ID, 'USDT');
  } catch (e) {
    console.error(`❌ Failed to mint USDT:`, e.message);
  }

  console.log('\n✅ Minting complete. Run node scripts/seed-router.mjs to seed the router.');
}

main().catch(console.error);
