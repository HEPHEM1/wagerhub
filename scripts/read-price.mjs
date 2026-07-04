import hre from "hardhat";

const ROUTER_ADDRESS = "0x6537858BbFAC09f4C3aBfCb1bf7A72867fFeB6bd";
const ABI = [
  "function hbarUsdPrice() external view returns (uint256)",
  "function usdcToken() external view returns (address)",
  "function usdtToken() external view returns (address)"
];

async function main() {
  console.log("=== Checking Router State ===");
  const provider = hre.ethers.provider;
  const router = new hre.ethers.Contract(ROUTER_ADDRESS, ABI, provider);

  const price = await router.hbarUsdPrice();
  console.log("hbarUsdPrice on-chain:", price.toString());
  
  const usdcBal = await provider.getBalance(await router.usdcToken());
  console.log("USDC address:", await router.usdcToken());
}

main().catch(console.error).finally(() => process.exit(0));
