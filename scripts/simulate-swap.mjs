import hre from "hardhat";

const ROUTER = "0x6537858BbFAC09f4C3aBfCb1bf7A72867fFeB6bd";
const ABI = [
  "function swapHbarForToken(string tokenOutSymbol, uint256 minAmountOut) external payable",
  "function hbarUsdPrice() external view returns (uint256)"
];

async function main() {
  const provider = hre.ethers.provider;
  const router = new hre.ethers.Contract(ROUTER, ABI, provider);
  const [deployer] = await hre.ethers.getSigners();

  const hbarWei = hre.ethers.parseEther("16");

  console.log("Simulating with minAmountOut = 0...");
  try {
    const tx = await router.swapHbarForToken.staticCall("USDC", 0, { value: hbarWei, from: deployer.address });
    console.log("Static call succeeded! No revert.");
  } catch (err) {
    console.log("Static call REVERTED with 0:", err.message);
  }
}

main().catch(console.error).finally(() => process.exit(0));
