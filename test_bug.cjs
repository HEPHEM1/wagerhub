const { ContractExecuteTransaction, ContractId, ContractFunctionParameters, Hbar, Client, AccountId } = require('@hashgraph/sdk');

async function test() {
  const tx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromString('0.0.9289511'))
    .setGas(2000000)
    .setPayableAmount(new Hbar(1))
    .setFunctionParameters(Buffer.from('abcdef', 'hex'))
    .setTransactionId({ accountId: AccountId.fromString('0.0.8800842'), validStart: new Date() })
    .setNodeAccountIds([AccountId.fromString('0.0.3')]);

  tx.freeze();
  try {
    tx.toBytes();
    console.log('SUCCESS');
  } catch(e) {
    console.error('FAILED:', e.message);
  }
}

test();
