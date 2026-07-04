import hre from "hardhat";

const ROUTER      = "0x9E80E3a85224190e6b87b7aaa3B6205de4Ef9AC1";
const DEPLOYER    = "0x42BEFf828729D60A84Fc8dcCDA49a7614D0259F4";
const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f"; // 0.0.8818191
const USDC_TOKEN  = "0x00000000000000000000000000000000008f4312"; // 0.0.9388818
const USDT_TOKEN  = "0x00000000000000000000000000000000008f4310"; // 0.0.9388816

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
];

const TOKEN_TX_OPTS = { gasLimit: 800_000, gasPrice: 1_650_000_000_000n };

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;

  const usdcC = new hre.ethers.Contract(USDC_TOKEN, ERC20_ABI, deployer);
  const usdtC = new hre.ethers.Contract(USDT_TOKEN, ERC20_ABI, deployer);
  const wagerC = new hre.ethers.Contract(WAGER_TOKEN, ERC20_ABI, deployer);

  const [usdcBal, usdtBal, wagerBal] = await Promise.all([
    usdcC.balanceOf(DEPLOYER).catch(() => 0n),
    usdtC.balanceOf(DEPLOYER).catch(() => 0n),
    wagerC.balanceOf(DEPLOYER).catch(() => 0n),
  ]);

  console.log("\n=== Seeding available tokens ===");

  if (usdtBal > 0n) {
    console.log(`  Sending USDT...`);
    try {
      const tx = await usdtC.transfer(ROUTER, usdtBal, TOKEN_TX_OPTS);
      await tx.wait();
      console.log(`  ✅ USDT seeded!`);
    } catch(e) { console.log(`  ❌ USDT failed: ${e.message}`); }
  }

  if (usdcBal > 0n) {
    console.log(`  Sending USDC...`);
    try {
      const tx = await usdcC.transfer(ROUTER, usdcBal, TOKEN_TX_OPTS);
      await tx.wait();
      console.log(`  ✅ USDC seeded!`);
    } catch(e) { console.log(`  ❌ USDC failed: ${e.message}`); }
  }

  if (wagerBal > 0n) {
    console.log(`  Sending WAGER...`);
    try {
      const tx = await wagerC.transfer(ROUTER, wagerBal, TOKEN_TX_OPTS);
      await tx.wait();
      console.log(`  ✅ WAGER seeded!`);
    } catch(e) { console.log(`  ❌ WAGER failed: ${e.message}`); }
  }

  const hbarWei = await provider.getBalance(DEPLOYER);
  if (hbarWei > hre.ethers.parseEther("50")) {
    console.log(`  Sending 50 HBAR...`);
    try {
      const tx = await deployer.sendTransaction({
        to: ROUTER,
        value: hre.ethers.parseEther("50"),
        ...TOKEN_TX_OPTS
      });
      await tx.wait();
      console.log(`  ✅ HBAR seeded!`);
    } catch (e) { console.log(`  ❌ HBAR failed: ${e.message}`); }
  }

  console.log("\n=== Final Router Balances ===");
  const rHbar2 = await provider.getBalance(ROUTER);
  const [rUsdc2, rUsdt2, rWager2] = await Promise.all([
    usdcC.balanceOf(ROUTER).catch(() => 0n),
    usdtC.balanceOf(ROUTER).catch(() => 0n),
    wagerC.balanceOf(ROUTER).catch(() => 0n),
  ]);
  console.log(`HBAR  : ${hre.ethers.formatEther(rHbar2)} HBAR`);
  console.log(`USDC  : ${hre.ethers.formatUnits(rUsdc2, 6)} USDC`);
  console.log(`USDT  : ${hre.ethers.formatUnits(rUsdt2, 6)} USDT`);
  console.log(`WAGER : ${hre.ethers.formatUnits(rWager2, 8)} WAGER`);
}

main().catch(console.error).finally(() => process.exit(0));
