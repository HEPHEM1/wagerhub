import hre from "hardhat";

const ROUTER = "0x9E80E3a85224190e6b87b7aaa3B6205de4Ef9AC1";
const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f";

const ABI = [
  "function withdrawLiquidity(address tokenAddress, uint256 amount) external",
];

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
];

async function main() {
  const provider = hre.ethers.provider;
  const [deployer] = await hre.ethers.getSigners();
  const router = new hre.ethers.Contract(ROUTER, ABI, deployer);
  const wagerC = new hre.ethers.Contract(WAGER_TOKEN, ERC20_ABI, provider);

  const hbarWei = await provider.getBalance(ROUTER);
  const hbarVal = Number(hre.ethers.formatEther(hbarWei)); // e.g. 127.0
  console.log(`Router HBAR: ${hbarVal}`);

  const wagerRaw = await wagerC.balanceOf(ROUTER);
  const wagerVal = Number(hre.ethers.formatUnits(wagerRaw, 8)); // e.g. 594860.14
  console.log(`Router WAGER: ${wagerVal}`);

  // Target ratio: 1 WAGER = 0.1 HBAR -> HBAR/WAGER = 0.1 -> WAGER = HBAR * 10
  const targetWager = hbarVal * 10;
  console.log(`Target WAGER: ${targetWager}`);

  if (wagerVal > targetWager) {
    const toWithdraw = wagerVal - targetWager;
    const withdrawUnits = hre.ethers.parseUnits(toWithdraw.toFixed(8), 8);
    console.log(`Withdrawing ${toWithdraw} WAGER...`);
    const tx = await router.withdrawLiquidity(WAGER_TOKEN, withdrawUnits, { gasLimit: 800000, gasPrice: 1650000000000n });
    await tx.wait();
    console.log(`✅ Withdrawn successfully! Tx: ${tx.hash}`);
  } else {
    console.log("Pool does not have excess WAGER.");
  }
}

main().catch(console.error).finally(() => process.exit(0));
