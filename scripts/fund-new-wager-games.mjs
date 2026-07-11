/**
 * Fund the newly deployed WagerGames contract with 100,000 $WAGER
 */
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const NEW_WAGER_GAMES = "0x31f659b77ba360729d1d0f2584de9be770ad3b42";
const WAGER_TOKEN = "0x0000000000000000000000000000000000868e0f";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const pkey = process.env.HEDERA_OPERATOR_KEY;
  const signer = new ethers.Wallet(pkey.startsWith("0x") ? pkey : "0x" + pkey, provider);
  console.log(`Signer: ${signer.address}`);

  const wager = new ethers.Contract(WAGER_TOKEN, [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
  ], signer);

  const bal = await wager.balanceOf(signer.address);
  console.log(`Deployer $WAGER: ${ethers.formatUnits(bal, 8)}`);

  const amount = ethers.parseUnits("100000", 8);
  const toSend = bal < amount ? bal : amount;

  console.log(`Sending ${ethers.formatUnits(toSend, 8)} $WAGER to new WagerGames...`);
  const tx = await wager.transfer(NEW_WAGER_GAMES, toSend, { gasLimit: 1_000_000 });
  console.log(`Tx: ${tx.hash}`);
  await tx.wait();

  const newBal = await wager.balanceOf(NEW_WAGER_GAMES);
  console.log(`✅ New WagerGames $WAGER balance: ${ethers.formatUnits(newBal, 8)}`);
}

main().catch(err => {
  console.error("❌ FAILED:", err.shortMessage || err.message);
  process.exit(1);
});
