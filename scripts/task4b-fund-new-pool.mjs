/**
 * Task 4b: Fund the newly redeployed WagerSwapPool
 *
 * Run: node scripts/task4b-fund-new-pool.mjs
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const NEW_POOL_ADDRESS = '0xaBF06E296baF863CB0634f14D7b35BF336a5675e';
const WAGER_TOKEN      = '0x0000000000000000000000000000000000868e0f';
const USDT_TOKEN       = '0x0000000000000000000000000000000000869922';
const USDC_TOKEN       = '0x0000000000000000000000000000000000869923';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

async function sendToken(signer, tokenAddr, symbol, decimals, toAddr, rawAmount) {
  const contract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
  const humanAmt = Number(rawAmount) / Math.pow(10, decimals);
  console.log(`  Sending ${humanAmt.toLocaleString()} ${symbol}...`);
  const tx = await contract.transfer(toAddr, rawAmount);
  const receipt = await tx.wait();
  console.log(`  ✅ Tx: ${receipt.hash}\n`);
}

async function main() {
  const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
  if (!OPERATOR_KEY) throw new Error('Missing HEDERA_OPERATOR_KEY in .env.local');

  const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const signer   = new ethers.Wallet(OPERATOR_KEY, provider);

  console.log('=== Task 4b: Funding New WagerSwapPool ===');
  console.log('New Pool :', NEW_POOL_ADDRESS);
  console.log('Signer   :', signer.address);
  console.log('');

  // 200 HBAR (18 decimal representation on EVM)
  console.log('  Sending 200 HBAR...');
  const hbarTx = await signer.sendTransaction({
    to: NEW_POOL_ADDRESS,
    value: ethers.parseEther('200'),
  });
  await hbarTx.wait();
  console.log(`  ✅ HBAR sent! Tx: ${hbarTx.hash}\n`);

  // 50,000 WAGER
  await sendToken(signer, WAGER_TOKEN, '$WAGER', 8, NEW_POOL_ADDRESS, ethers.parseUnits('50000', 8));

  // 20,000 USDT
  await sendToken(signer, USDT_TOKEN, 'USDT', 6, NEW_POOL_ADDRESS, ethers.parseUnits('20000', 6));

  // 20,000 USDC
  await sendToken(signer, USDC_TOKEN, 'USDC', 6, NEW_POOL_ADDRESS, ethers.parseUnits('20000', 6));

  // Final snapshot
  const hbarBal   = await provider.getBalance(NEW_POOL_ADDRESS);
  const wagerC    = new ethers.Contract(WAGER_TOKEN, ERC20_ABI, provider);
  const poolWager = await wagerC.balanceOf(NEW_POOL_ADDRESS);

  console.log('━━━ New Pool Snapshot ━━━');
  console.log(`HBAR   : ${(Number(hbarBal) / 1e18).toFixed(2)} HBAR`);
  console.log(`$WAGER : ${(Number(poolWager) / 1e8).toFixed(2)} WAGER`);
  console.log('USDT   : 20,000 USDT');
  console.log('USDC   : 20,000 USDC');
  console.log('');
  console.log('🎉 New WagerSwapPool fully funded!');
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
