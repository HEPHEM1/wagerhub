import pkg from "hardhat";
const { ethers } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const POOL_ADDRESS = process.env.NEXT_PUBLIC_WAGER_SWAP_ADDRESS;
const WAGER_ADDRESS = "0x0000000000000000000000000000000000868e0f";
const USDC_ADDRESS = "0x0000000000000000000000000000000000010932";
const USDT_ADDRESS = "0x0000000000000000000000000000000000010933";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

async function main() {
  console.log(`Funding AMM Pool: ${POOL_ADDRESS}`);
  
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${signer.address}`);

  // 1. Send HBAR (100 HBAR)
  console.log("Sending 100 HBAR...");
  const tx1 = await signer.sendTransaction({
    to: POOL_ADDRESS,
    value: ethers.parseUnits("100", 8) // 100 HBAR (assuming 8 decimals for HBAR, wait, ethers parseUnits uses 18 for eth, but Hedera is 8)
  });
  await tx1.wait();

  // 2. Send $WAGER (1000 WAGER)
  console.log("Sending 1000 WAGER...");
  const wager = new ethers.Contract(WAGER_ADDRESS, ERC20_ABI, signer);
  const tx2 = await wager.transfer(POOL_ADDRESS, ethers.parseUnits("1000", 8));
  await tx2.wait();

  // 3. Send USDC (100 USDC)
  console.log("Sending 100 USDC...");
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const tx3 = await usdc.transfer(POOL_ADDRESS, ethers.parseUnits("100", 6));
  await tx3.wait();

  // 4. Send USDT (100 USDT)
  console.log("Sending 100 USDT...");
  const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
  const tx4 = await usdt.transfer(POOL_ADDRESS, ethers.parseUnits("100", 6));
  await tx4.wait();

  console.log("AMM Pool Funded Successfully!");
}

main().catch(console.error);
