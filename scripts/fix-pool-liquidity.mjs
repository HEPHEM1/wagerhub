import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Pool address from evm-contracts.ts
const POOL_ADDRESS = '0x9E80E3a85224190e6b87b7aaa3B6205de4Ef9AC1';
// WAGER token Hedera ID 0.0.8818191 -> 0x868e0f -> 0x0000000000000000000000000000000000868e0f
const WAGER_TOKEN  = '0x0000000000000000000000000000000000868e0f';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

async function main() {
  const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
  if (!OPERATOR_KEY) throw new Error('Missing HEDERA_OPERATOR_KEY');

  const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const signer   = new ethers.Wallet(OPERATOR_KEY, provider);

  const contract = new ethers.Contract(WAGER_TOKEN, ERC20_ABI, signer);
  const amountToTransfer = ethers.parseUnits('350000', 8);

  console.log('Transferring 350,000 WAGER to Pool via EVM...');
  const tx = await contract.transfer(POOL_ADDRESS, amountToTransfer);
  console.log('Tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('✅ Tx confirmed:', receipt.status);

  const newBal = await contract.balanceOf(POOL_ADDRESS);
  console.log('New Pool WAGER balance:', ethers.formatUnits(newBal, 8));
}

main().catch(console.error);
