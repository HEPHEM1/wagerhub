import hre from "hardhat";

const ROUTER = "0x9E80E3a85224190e6b87b7aaa3B6205de4Ef9AC1";
const ABI = [
  "function usdcToken() external view returns (address)",
  "function usdtToken() external view returns (address)",
  "function wagerToken() external view returns (address)"
];

async function main() {
  const provider = hre.ethers.provider;
  const router = new hre.ethers.Contract(ROUTER, ABI, provider);

  const usdc = await router.usdcToken();
  const usdt = await router.usdtToken();
  const wager = await router.wagerToken();

  console.log(`USDC: ${usdc}`);
  console.log(`USDT: ${usdt}`);
  console.log(`WAGER: ${wager}`);
}

main().catch(console.error).finally(() => process.exit(0));
