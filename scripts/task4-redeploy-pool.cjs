/**
 * Task 4: Redeploy WagerSwapPool with correct Mock USDT/USDC addresses
 *
 * The original WagerSwapPool was deployed with placeholder USDC/USDT addresses
 * that don't exist on testnet. This script deploys a fresh WagerSwapPool
 * pointing to our real Mock stablecoins, then updates .env.local automatically.
 *
 * Run: npx hardhat run scripts/task4-redeploy-pool.cjs --network hedera
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");

const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f"; // 0.0.8818191 - $WAGER
const USDT_TOKEN  = "0x0000000000000000000000000000000000869922"; // 0.0.8819490 - Mock USDT
const USDC_TOKEN  = "0x0000000000000000000000000000000000869923"; // 0.0.8819491 - Mock USDC

async function main() {
  const { ethers } = require("hardhat");
  const [deployer] = await ethers.getSigners();

  console.log("=== Task 4: Redeploying WagerSwapPool ===");
  console.log("Deployer  :", deployer.address);
  console.log("$WAGER    :", WAGER_TOKEN);
  console.log("Mock USDT :", USDT_TOKEN);
  console.log("Mock USDC :", USDC_TOKEN);
  console.log("");

  console.log("Compiling and deploying WagerSwapPool...");
  const WagerSwapPool = await ethers.getContractFactory("WagerSwapPool");
  const pool = await WagerSwapPool.deploy(WAGER_TOKEN, USDC_TOKEN, USDT_TOKEN, {
    gasLimit: 3_000_000,
  });
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  console.log("✅ WagerSwapPool deployed to:", poolAddress);
  console.log("");

  // Update .env.local with the new pool address
  const envPath = path.join(__dirname, "..", ".env.local");
  let envContent = fs.readFileSync(envPath, "utf8");
  if (envContent.includes("NEXT_PUBLIC_WAGER_SWAP_ADDRESS=")) {
    envContent = envContent.replace(
      /NEXT_PUBLIC_WAGER_SWAP_ADDRESS=.*/,
      `NEXT_PUBLIC_WAGER_SWAP_ADDRESS=${poolAddress}`
    );
  } else {
    envContent += `\nNEXT_PUBLIC_WAGER_SWAP_ADDRESS=${poolAddress}`;
  }
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("✅ .env.local updated with new pool address.");
  console.log("");
  console.log("=====================================================");
  console.log("IMPORTANT: Also update src/evm-contracts.ts:");
  console.log("=====================================================");
  console.log(`export const MOCK_WAGER_SWAP_POOL_ADDRESS = "${poolAddress}";`);
  console.log("=====================================================");
  console.log("");
  console.log("Next: Fund the new pool with task3 amounts, then git push.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
  });
