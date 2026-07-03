import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Token addresses on Hedera Testnet ─────────────────────────────────
// Hedera ID  → EVM address: 0x + decimal padded to 40 hex chars
const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f"; // 0.0.8818191
const USDC_TOKEN  = "0x00000000000000000000000000000000008f4312"; // 0.0.9388818
const USDT_TOKEN  = "0x00000000000000000000000000000000008f4310"; // 0.0.9388816

// Initial HBAR/USD price: $0.07172 → 71720 (scaled to 6 decimal places, matching USDC)
// Owner can call setHbarUsdPrice() on-chain at any time to update.
const INITIAL_HBAR_USD_PRICE = 71720n;

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
];

// Gas overrides — Hedera rejects eth_estimateGas with INSUFFICIENT_TX_FEE.
// Passing explicit values on every tx bypasses estimation entirely.
const TX_OPTS = { gasLimit: 4_000_000, gasPrice: 1_650_000_000_000n };

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("=== Deploying HybridWagerSwapRouter (No-Oracle) ===");
  console.log(`Deployer: ${deployer.address}\n`);

  const Factory = await hre.ethers.getContractFactory("HybridWagerSwapRouter");
  const router = await Factory.deploy(
    WAGER_TOKEN,
    USDC_TOKEN,
    USDT_TOKEN,
    INITIAL_HBAR_USD_PRICE,
    TX_OPTS
  );
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✅ HybridWagerSwapRouter deployed to: ${routerAddress}`);
  console.log(`   Initial hbarUsdPrice: ${INITIAL_HBAR_USD_PRICE} ($${Number(INITIAL_HBAR_USD_PRICE) / 1e6})\n`);

  // ── Update .env.local ─────────────────────────────────────────────
  const envPath = path.resolve(".env.local");
  let envContent = fs.readFileSync(envPath, "utf8");
  envContent = envContent.replace(
    /NEXT_PUBLIC_WAGER_SWAP_ADDRESS=.*/,
    `NEXT_PUBLIC_WAGER_SWAP_ADDRESS=${routerAddress}`
  );
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("✅ Updated .env.local with new router address.\n");

  // ── Seed Treasury Vault ────────────────────────────────────────────
  console.log("=== Seeding Treasury Vault (Router) ===");

  console.log("  Sending 200 HBAR...");
  const hbarTx = await deployer.sendTransaction({ to: routerAddress, value: hre.ethers.parseEther("200"), ...TX_OPTS });
  await hbarTx.wait();
  console.log(`  ✅ HBAR seeded! Tx: ${hbarTx.hash}`);

  const wagerC = new hre.ethers.Contract(WAGER_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 50,000 WAGER...");
  const wTx = await wagerC.transfer(routerAddress, hre.ethers.parseUnits("50000", 8), TX_OPTS);
  await wTx.wait();
  console.log(`  ✅ WAGER seeded! Tx: ${wTx.hash}`);

  const usdtC = new hre.ethers.Contract(USDT_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 10,000 USDT...");
  const tTx = await usdtC.transfer(routerAddress, hre.ethers.parseUnits("10000", 6), TX_OPTS);
  await tTx.wait();
  console.log(`  ✅ USDT seeded! Tx: ${tTx.hash}`);

  const usdcC = new hre.ethers.Contract(USDC_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 10,000 USDC...");
  const cTx = await usdcC.transfer(routerAddress, hre.ethers.parseUnits("10000", 6), TX_OPTS);
  await cTx.wait();
  console.log(`  ✅ USDC seeded! Tx: ${cTx.hash}\n`);

  console.log("🎉 No-Oracle Hybrid Router Fully Deployed and Seeded!");
  console.log(`\n📋 NEW CONTRACT ADDRESS: ${routerAddress}`);
  console.log(`   Update src/evm-contracts.ts: MOCK_WAGER_SWAP_POOL_ADDRESS = "${routerAddress}"`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
