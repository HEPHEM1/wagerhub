import { Client, PrivateKey, TokenMintTransaction, AccountId, TokenId } from '@hashgraph/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPERATOR_ID  = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;

// EVM address 0x0000000000000000000000000000000000868e0f
// 0x868e0f in decimal = 8818191 => Hedera Token ID: 0.0.8818191
const WAGER_TOKEN_ID = '0.0.8818191';

// 100,000 WAGER * 10^8 decimals = 10,000,000,000,000
const AMOUNT_TO_MINT = 100_000n * 100_000_000n;

async function main() {
  if (!OPERATOR_ID || !OPERATOR_KEY) {
    throw new Error('Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY in .env.local');
  }

  const parsedKey = OPERATOR_KEY.startsWith('0x')
    ? PrivateKey.fromStringECDSA(OPERATOR_KEY)
    : PrivateKey.fromString(OPERATOR_KEY);

  const client = Client.forTestnet().setOperator(AccountId.fromString(OPERATOR_ID), parsedKey);

  console.log('=== Task 1: Minting 100,000 $WAGER ===');
  console.log('Operator  :', OPERATOR_ID);
  console.log('Token ID  :', WAGER_TOKEN_ID);
  console.log('Raw Amount:', AMOUNT_TO_MINT.toString(), '(8 decimal places)');
  console.log('');

  try {
    const mintTx = await new TokenMintTransaction()
      .setTokenId(TokenId.fromString(WAGER_TOKEN_ID))
      .setAmount(AMOUNT_TO_MINT)
      .freezeWith(client)
      .sign(parsedKey);

    const txResponse = await mintTx.execute(client);
    const receipt    = await txResponse.getReceipt(client);

    console.log('✅ SUCCESS!');
    console.log('   Status :', receipt.status.toString());
    console.log('   Tx ID  :', txResponse.transactionId.toString());
    console.log('');
    console.log('100,000 $WAGER minted to treasury wallet:', OPERATOR_ID);
    console.log('Next step: run  node scripts/task2-deploy-mock-stables.mjs');
  } catch (err) {
    if (err.message && err.message.includes('TOKEN_HAS_NO_SUPPLY_KEY')) {
      console.error('');
      console.error('❌ FAILED: TOKEN_HAS_NO_SUPPLY_KEY');
      console.error('   The $WAGER token was created without a supply key, or the');
      console.error('   supply key does not match your deployer key.');
      console.error('   Solution: Transfer $WAGER from the original treasury wallet instead.');
    } else {
      console.error('❌ Error:', err.message || err);
    }
    process.exit(1);
  }
}

main();
