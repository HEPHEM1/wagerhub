/**
 * Task 3: Fund the WagerHub Two-Vault Ecosystem
 *
 * Vault 1 - WagerSwapPool (DEX Liquidity):
 *   - 500 HBAR  (native transfer)
 *   - 50,000 WAGER
 *   - 20,000 USDT
 *   - 20,000 USDC
 *
 * Vault 2 - WagerGames (House Bankroll):
 *   - 50,000 WAGER (covers up to 10,000 WAGER bets at 5x payout)
 *
 * NOTE: The WagerSwapPool uses a simple direct-transfer liquidity model.
 * There is no addLiquidity() function — tokens sent to the contract ARE the liquidity.
 * The WagerGames contract also just receives tokens via transfer().
 *
 * Run: node scripts/task3-fund-ecosystem.mjs
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// ── Addresses ─────────────────────────────────────────────────────────────────
const WAGER_SWAP_POOL  = '0x8394B7DC655c3b70c4b785f20F25fe8bD6B74B95';
const WAGER_GAMES      = '0x0EAe037F84Aa46804eaeeC146E3CB12391B875b4';
const WAGER_TOKEN      = '0x0000000000000000000000000000000000868e0f';  // 0.0.8818191
const USDT_TOKEN       = '0x0000000000000000000000000000000000869922';  // 0.0.8819490 - Mock USDT
const USDC_TOKEN       = '0x0000000000000000000000000000000000869923';  // 0.0.8819491 - Mock USDC

// ── Amounts ───────────────────────────────────────────────────────────────────
const POOL_HBAR_AMOUNT   = ethers.parseUnits('500', 18);       // 500 HBAR (18 decimals on EVM)
const POOL_WAGER_AMOUNT  = ethers.parseUnits('50000', 8);      // 50,000 WAGER (8 decimals)
const POOL_USDT_AMOUNT   = ethers.parseUnits('20000', 6);      // 20,000 USDT  (6 decimals)
const POOL_USDC_AMOUNT   = ethers.parseUnits('20000', 6);      // 20,000 USDC  (6 decimals)
const GAMES_WAGER_AMOUNT = ethers.parseUnits('50000', 8);      // 50,000 WAGER for house bankroll

// ── Minimal ERC-20 ABI ────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sendToken(signer, tokenAddr, tokenSymbol, decimals, toAddr, toLabel, rawAmount) {
  const contract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
  const balance  = await contract.balanceOf(signer.address);
  const humanBal = Number(balance) / Math.pow(10, decimals);
  const humanAmt = Number(rawAmount) / Math.pow(10, decimals);

  console.log(`  Sending ${humanAmt.toLocaleString()} ${tokenSymbol} to ${toLabel}...`);
  console.log(`    (Your balance: ${humanBal.toLocaleString()} ${tokenSymbol})`);

  if (balance < rawAmount) {
    throw new Error(`Insufficient ${tokenSymbol}! Have ${humanBal}, need ${humanAmt}`);
  }

  const tx      = await contract.transfer(toAddr, rawAmount);
  const receipt = await tx.wait();
  console.log(`  ✅ ${tokenSymbol} sent! Tx: ${receipt.hash}\n`);
  return receipt;
}

async function sendHbar(signer, toAddr, toLabel, rawAmount) {
  const humanAmt = Number(rawAmount) / 1e18;
  console.log(`  Sending ${humanAmt} HBAR to ${toLabel}...`);
  const tx      = await signer.sendTransaction({ to: toAddr, value: rawAmount });
  const receipt = await tx.wait();
  console.log(`  ✅ HBAR sent! Tx: ${receipt.hash}\n`);
  return receipt;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
  if (!OPERATOR_KEY) throw new Error('Missing HEDERA_OPERATOR_KEY in .env.local');

  const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const signer   = new ethers.Wallet(OPERATOR_KEY, provider);

  console.log('');
  console.log('=== Task 3: Funding the WagerHub Two-Vault Ecosystem ===');
  console.log(`Signer        : ${signer.address}`);
  console.log(`WagerSwapPool : ${WAGER_SWAP_POOL}`);
  console.log(`WagerGames    : ${WAGER_GAMES}`);
  console.log('');

  // ── VAULT 1: WagerSwapPool ────────────────────────────────────────────────
  console.log('━━━ VAULT 1: WagerSwapPool (DEX Liquidity) ━━━');

  await sendHbar(signer, WAGER_SWAP_POOL, 'WagerSwapPool', POOL_HBAR_AMOUNT);
  await sendToken(signer, WAGER_TOKEN, '$WAGER', 8, WAGER_SWAP_POOL, 'WagerSwapPool', POOL_WAGER_AMOUNT);
  await sendToken(signer, USDT_TOKEN,  'USDT',   6, WAGER_SWAP_POOL, 'WagerSwapPool', POOL_USDT_AMOUNT);
  await sendToken(signer, USDC_TOKEN,  'USDC',   6, WAGER_SWAP_POOL, 'WagerSwapPool', POOL_USDC_AMOUNT);

  console.log('✅ Vault 1 fully funded!\n');

  // ── VAULT 2: WagerGames ───────────────────────────────────────────────────
  console.log('━━━ VAULT 2: WagerGames (House Bankroll) ━━━');

  await sendToken(signer, WAGER_TOKEN, '$WAGER', 8, WAGER_GAMES, 'WagerGames', GAMES_WAGER_AMOUNT);

  console.log('✅ Vault 2 fully funded!\n');

  // ── Final Balance Check ───────────────────────────────────────────────────
  console.log('━━━ Final Pool Reserve Snapshot ━━━');
  const provider2 = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');

  const hbarBal  = await provider2.getBalance(WAGER_SWAP_POOL);
  const wagerC   = new ethers.Contract(WAGER_TOKEN, ERC20_ABI, provider2);
  const usdtC    = new ethers.Contract(USDT_TOKEN,  ERC20_ABI, provider2);
  const usdcC    = new ethers.Contract(USDC_TOKEN,  ERC20_ABI, provider2);
  const gamesC   = new ethers.Contract(WAGER_TOKEN, ERC20_ABI, provider2);

  const [poolWager, poolUsdt, poolUsdc, gamesWager] = await Promise.all([
    wagerC.balanceOf(WAGER_SWAP_POOL),
    usdtC.balanceOf(WAGER_SWAP_POOL),
    usdcC.balanceOf(WAGER_SWAP_POOL),
    gamesC.balanceOf(WAGER_GAMES),
  ]);

  console.log('');
  console.log('WagerSwapPool:');
  console.log(`  HBAR   : ${(Number(hbarBal) / 1e18).toFixed(4)} HBAR`);
  console.log(`  $WAGER : ${(Number(poolWager) / 1e8).toFixed(2)} WAGER`);
  console.log(`  USDT   : ${(Number(poolUsdt)  / 1e6).toFixed(2)} USDT`);
  console.log(`  USDC   : ${(Number(poolUsdc)  / 1e6).toFixed(2)} USDC`);
  console.log('');
  console.log('WagerGames (House Bankroll):');
  console.log(`  $WAGER : ${(Number(gamesWager) / 1e8).toFixed(2)} WAGER`);
  console.log('');
  console.log('🎉 ECOSYSTEM FULLY FUNDED! WagerHub is ready for live testing.');
}

main().catch((err) => {
  console.error('❌ Fatal Error:', err.message || err);
  process.exit(1);
});
