import { Client, AccountBalanceQuery, AccountId } from '@hashgraph/sdk';

async function main() {
  const client = Client.forTestnet();
  const operatorId = '0.0.8814484'; // Deployer wallet ID

  const query = new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(operatorId));

  const balance = await query.execute(client);
  console.log('HBAR Balance:', balance.hbars.toString());
  console.log('--- Tokens ---');
  if (balance.tokens) {
      for (const [tokenId, val] of balance.tokens.entries()) {
          console.log(`Token ID: ${tokenId.toString()} - Balance: ${val.toString()}`);
      }
  } else {
      console.log('No tokens');
  }
}
main().catch(console.error);
