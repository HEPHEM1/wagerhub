import { Client, TokenInfoQuery } from '@hashgraph/sdk';

async function main() {
  const client = Client.forTestnet();
  for (const id of ['0.0.9388816', '0.0.9388818']) {
    const q = new TokenInfoQuery().setTokenId(id);
    const info = await q.execute(client);
    console.log(`${id} => ${info.name} (${info.symbol})`);
  }
}
main().catch(console.error);
