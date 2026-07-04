import hre from "hardhat";

const ROUTER = "0x9E80E3a85224190e6b87b7aaa3B6205de4Ef9AC1";
const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f";
const ABI = [
  "function swapTokenForHbar(string tokenInSymbol, uint256 amountIn, uint256 minAmountOut) external payable"
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
];

async function main() {
  const provider = hre.ethers.provider;
  const [deployer] = await hre.ethers.getSigners();
  const router = new hre.ethers.Contract(ROUTER, ABI, deployer);
  const wager = new hre.ethers.Contract(WAGER_TOKEN, ERC20_ABI, deployer);

  const amountIn = hre.ethers.parseUnits("100", 8); // 100 WAGER
  const minAmountOut = hre.ethers.parseUnits("10", 8); // 10 HBAR (in tinybars)

  console.log("Approving router...");
  const tx = await wager.approve(ROUTER, amountIn, { gasLimit: 800000, gasPrice: 1650000000000n });
  await tx.wait();

  console.log("Simulating swapTokenForHbar...");
  try {
    await router.swapTokenForHbar.staticCall("$WAGER", amountIn, minAmountOut, { gasLimit: 4000000, gasPrice: 1650000000000n });
    console.log("Static call succeeded!");
  } catch (err) {
    console.log("Static call REVERTED:", err.message);
  }
}

main().catch(console.error).finally(() => process.exit(0));
