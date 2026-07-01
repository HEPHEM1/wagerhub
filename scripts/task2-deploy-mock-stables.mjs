import {
  Client,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPERATOR_ID  = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;

/**
 * Creates a new HTS fungible token (Mock stablecoin) on Hedera Testnet.
 * Treasury = your deployer wallet, so all initial supply lands in your wallet.
 */
async function createToken(client, parsedKey, name, symbol, decimals, initialSupplyUnits) {
  console.log(`Creating ${symbol} (${name})...`);

  // Convert human-readable units to raw integer with decimals
  const rawSupply = BigInt(initialSupplyUnits) * (10n ** BigInt(decimals));

  const tx = await new TokenCreateTransaction()
    .setTokenName(name)
    .setTokenSymbol(symbol)
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(decimals)
    .setInitialSupply(rawSupply)
    .setTreasuryAccountId(AccountId.fromString(OPERATOR_ID))
    .setAdminKey(parsedKey)   // lets us update the token later
    .setSupplyKey(parsedKey)  // lets us mint more later
    .setSupplyType(TokenSupplyType.Infinite)
    .freezeWith(client)
    .sign(parsedKey);

  const resp    = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  const tokenId = receipt.tokenId.toString();

  // Derive the EVM address: shard.realm.NUM -> 0x + hex(NUM) padded to 40 chars
  const num     = BigInt(tokenId.split('.')[2]);
  const evmAddr = '0x' + num.toString(16).padStart(40, '0');

  console.log(`   ✅ Token ID  : ${tokenId}`);
  console.log(`   ✅ EVM Addr  : ${evmAddr}`);
  console.log(`   ✅ Supply    : ${initialSupplyUnits.toLocaleString()} ${symbol} (in your wallet)\n`);

  return { tokenId, evmAddr };
}

async function main() {
  if (!OPERATOR_ID || !OPERATOR_KEY) {
    throw new Error('Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY in .env.local');
  }

  const parsedKey = OPERATOR_KEY.startsWith('0x')
    ? PrivateKey.fromStringECDSA(OPERATOR_KEY)
    : PrivateKey.fromString(OPERATOR_KEY);

  const client = Client.forTestnet().setOperator(AccountId.fromString(OPERATOR_ID), parsedKey);

  console.log('=== Task 2: Deploying Mock Stablecoins to Hedera Testnet ===');
  console.log('Operator :', OPERATOR_ID);
  console.log('');

  const usdt = await createToken(client, parsedKey, 'Mock USDT (WagerHub)', 'USDT', 6, 50_000);
  const usdc = await createToken(client, parsedKey, 'Mock USDC (WagerHub)', 'USDC', 6, 50_000);

  console.log('');
  console.log('=====================================================');
  console.log('SUCCESS! Paste these lines into  src/evm.ts :');
  console.log('=====================================================');
  console.log(`export const EVM_USDT_ADDRESS = "${usdt.evmAddr}"; // ${usdt.tokenId}`);
  console.log(`export const EVM_USDC_ADDRESS = "${usdc.evmAddr}"; // ${usdc.tokenId}`);
  console.log('=====================================================');
  console.log('');
  console.log('Next step: run  node scripts/task3-fund-ecosystem.mjs');
}

main();
