import { Client, AccountBalanceQuery, AccountId } from '@hashgraph/sdk';

async function main() {
  const client = Client.forTestnet();
  const poolId = AccountId.fromEvmAddress(0, 0, '0xaBF06E296baF863CB0634f14D7b35BF336a5675e');
  
  const query = new AccountBalanceQuery().setAccountId(poolId);
  const balance = await query.execute(client);
  console.log('HBAR Balance:', balance.hbars.toString());
  console.log('--- Tokens ---');
  if (balance.tokens) {
      console.log(balance.tokens.toJSON());
  } else {
      console.log('No tokens');
  }
}
main().catch(console.error);
