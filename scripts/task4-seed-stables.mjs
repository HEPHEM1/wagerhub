/**
 * task4-seed-stables.mjs
 * 
 * 1. Redeploys WagerSwapPool with the CORRECT Mock USDT and Mock USDC addresses.
 *    (The previous EVM addresses were calculated incorrectly due to a hex conversion typo).
 * 2. Seeds the HBAR/USDC and HBAR/USDT pools with direct transfers.
 *    (Our WagerSwapPool uses direct transfers for liquidity, so no approve() or addLiquidity() is needed).
 * 
 * Run with: npx hardhat run scripts/task4-seed-stables.mjs --network hedera
 */

import hre from "hardhat";
import fs from "fs";
import path from "path";

// The ACTUAL token EVM addresses based on their real Hedera Token IDs:
// USDT: 0.0.9388816 -> 0x8f4310
// USDC: 0.0.9388818 -> 0x8f4312
const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f";
const USDT_TOKEN  = "0x00000000000000000000000000000000008f4310"; 
const USDC_TOKEN  = "0x00000000000000000000000000000000008f4312";

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("=== Redeploying WagerSwapPool (Fixing Token Addresses) ===");
  const WagerSwapPool = await hre.ethers.getContractFactory("WagerSwapPool");
  const pool = await WagerSwapPool.deploy(WAGER_TOKEN, USDC_TOKEN, USDT_TOKEN, {
    gasLimit: 3_000_000,
  });
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  
  console.log(`✅ WagerSwapPool deployed to: ${poolAddress}\n`);

  // Update .env.local
  const envPath = path.resolve(".env.local");
  let envContent = fs.readFileSync(envPath, "utf8");
  envContent = envContent.replace(
    /NEXT_PUBLIC_WAGER_SWAP_ADDRESS=.*/,
    `NEXT_PUBLIC_WAGER_SWAP_ADDRESS=${poolAddress}`
  );
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("✅ Updated .env.local with new pool address.\n");

  console.log("=== Seeding Liquidity Pools ===");
  console.log("Note: WagerSwapPool uses direct transfers for liquidity instead of an addLiquidity function.\n");

  // Send 200 HBAR for the HBAR side of all pairs
  console.log("  Sending 200 HBAR...");
  const hbarTx = await deployer.sendTransaction({
    to: poolAddress,
    value: hre.ethers.parseEther("200")
  });
  await hbarTx.wait();
  console.log(`  ✅ HBAR seeded! Tx: ${hbarTx.hash}`);

  // Send WAGER (re-funding)
  const wagerC = new hre.ethers.Contract(WAGER_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 50,000 WAGER...");
  const wTx = await wagerC.transfer(poolAddress, hre.ethers.parseUnits("50000", 8));
  await wTx.wait();
  console.log(`  ✅ WAGER seeded! Tx: ${wTx.hash}`);

  // Send USDT
  const usdtC = new hre.ethers.Contract(USDT_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 10,000 USDT...");
  const tTx = await usdtC.transfer(poolAddress, hre.ethers.parseUnits("10000", 6));
  await tTx.wait();
  console.log(`  ✅ USDT seeded! Tx: ${tTx.hash}`);

  // Send USDC
  const usdcC = new hre.ethers.Contract(USDC_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 10,000 USDC...");
  const cTx = await usdcC.transfer(poolAddress, hre.ethers.parseUnits("10000", 6));
  await cTx.wait();
  console.log(`  ✅ USDC seeded! Tx: ${cTx.hash}\n`);

  console.log("🎉 Ecosystem Fully Seeded!");
  console.log(`\nPlease update src/evm-contracts.ts with:`);
  console.log(`export const MOCK_WAGER_SWAP_POOL_ADDRESS = "${poolAddress}";`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
