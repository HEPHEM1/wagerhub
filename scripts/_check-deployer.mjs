import { Client, AccountBalanceQuery, AccountId } from '@hashgraph/sdk';

async function main() {
  const client = Client.forTestnet();
  const operatorId = '0.0.8814484'; // Deployer wallet ID
  const query = new AccountBalanceQuery().setAccountId(operatorId);
  const balance = await query.execute(client);
  console.log('--- Deployer Tokens ---');
  if (balance.tokens) {
      console.log(balance.tokens.toJSON());
  } else {
      console.log('No tokens');
  }
}
main().catch(console.error);
