import hre from "hardhat";

const ROUTER = "0x6537858BbFAC09f4C3aBfCb1bf7A72867fFeB6bd";
const ABI = [
  "function swapHbarForToken(string tokenOutSymbol, uint256 minAmountOut) external payable"
];

async function main() {
  const provider = hre.ethers.provider;
  const router = new hre.ethers.Contract(ROUTER, ABI, provider);
  const [deployer] = await hre.ethers.getSigners();
  const hbarWei = hre.ethers.parseEther("16");

  let low = 0n;
  let high = 2000000n; // 2 USDC
  let actualOut = 0n;

  console.log("Finding exact amountOut via staticCall binary search...");
  while (low <= high) {
    const mid = (low + high) / 2n;
    try {
      await router.swapHbarForToken.staticCall("USDC", mid, { value: hbarWei, from: deployer.address });
      // If it succeeds, actualOut >= mid, so search higher
      actualOut = mid;
      low = mid + 1n;
    } catch (err) {
      // If it reverts, actualOut < mid, so search lower
      high = mid - 1n;
    }
  }

  console.log(`\nEXACT amountOut inside contract for 16 HBAR: ${actualOut.toString()}`);
  console.log(`Which is ${Number(actualOut) / 1e6} USDC`);
}

main().catch(console.error).finally(() => process.exit(0));
