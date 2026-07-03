import hre from "hardhat";
import fs from "fs";
import path from "path";

const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f";
const USDT_TOKEN  = "0x00000000000000000000000000000000008f4310"; 
const USDC_TOKEN  = "0x00000000000000000000000000000000008f4312";

// Pyth address on Hedera Testnet
const PYTH_ADDRESS = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
// Pyth price feed ID for HBAR/USD (Testnet)
const HBAR_USD_FEED = "0xf2ef5dc6156e6cdccda6c315f3fc6de2bf37e9aecbc9b5efc51de98096c3e7c6";

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("=== Deploying HybridWagerSwapRouter ===");
  const Router = await hre.ethers.getContractFactory("HybridWagerSwapRouter");
  const router = await Router.deploy(WAGER_TOKEN, USDC_TOKEN, USDT_TOKEN, PYTH_ADDRESS, HBAR_USD_FEED, {
    gasLimit: 8_000_000,
  });
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  
  console.log(`✅ HybridWagerSwapRouter deployed to: ${routerAddress}\n`);

  // Update .env.local
  const envPath = path.resolve(".env.local");
  let envContent = fs.readFileSync(envPath, "utf8");
  envContent = envContent.replace(
    /NEXT_PUBLIC_WAGER_SWAP_ADDRESS=.*/,
    `NEXT_PUBLIC_WAGER_SWAP_ADDRESS=${routerAddress}`
  );
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("✅ Updated .env.local with new router address.\n");

  console.log("=== Seeding Treasury Vault (Router) ===");

  console.log("  Sending 200 HBAR...");
  const hbarTx = await deployer.sendTransaction({
    to: routerAddress,
    value: hre.ethers.parseEther("200")
  });
  await hbarTx.wait();
  console.log(`  ✅ HBAR seeded! Tx: ${hbarTx.hash}`);

  const wagerC = new hre.ethers.Contract(WAGER_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 50,000 WAGER...");
  const wTx = await wagerC.transfer(routerAddress, hre.ethers.parseUnits("50000", 8));
  await wTx.wait();
  console.log(`  ✅ WAGER seeded! Tx: ${wTx.hash}`);

  const usdtC = new hre.ethers.Contract(USDT_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 10,000 USDT...");
  const tTx = await usdtC.transfer(routerAddress, hre.ethers.parseUnits("10000", 6));
  await tTx.wait();
  console.log(`  ✅ USDT seeded! Tx: ${tTx.hash}`);

  const usdcC = new hre.ethers.Contract(USDC_TOKEN, ERC20_ABI, deployer);
  console.log("  Sending 10,000 USDC...");
  const cTx = await usdcC.transfer(routerAddress, hre.ethers.parseUnits("10000", 6));
  await cTx.wait();
  console.log(`  ✅ USDC seeded! Tx: ${cTx.hash}\n`);

  console.log("🎉 Hybrid Router Fully Deployed and Seeded!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
