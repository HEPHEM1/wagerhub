import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Pool address from evm-contracts.ts
const POOL_ADDRESS = '0x9E80E3a85224190e6b87b7aaa3B6205de4Ef9AC1';

const POOL_ABI = [
  'function withdrawLiquidity(address tokenAddress, uint256 amount) external'
];

async function main() {
  const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
  if (!OPERATOR_KEY) throw new Error('Missing HEDERA_OPERATOR_KEY');

  const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const signer   = new ethers.Wallet(OPERATOR_KEY, provider);

  const contract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);

  // Withdraw 2990 HBAR from the pool back to the treasury
  // leaving ~2.78 HBAR in the pool to heavily dilute the WAGER token's AMM exchange rate
  const amountToWithdraw = ethers.parseEther('2990');

  console.log('Withdrawing 2,990 HBAR from Pool to Treasury...');
  const tx = await contract.withdrawLiquidity(ethers.ZeroAddress, amountToWithdraw);
  console.log('Tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('✅ Tx confirmed:', receipt.status);

  const newBal = await provider.getBalance(POOL_ADDRESS);
  console.log('New Pool HBAR balance:', ethers.formatEther(newBal));
}

main().catch(console.error);
