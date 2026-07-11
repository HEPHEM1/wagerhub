import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const WAGER_GAMES = '0x970f1388ec811155ecb072bbbc48c6be17c60522';
const WAGER_TOKEN = '0x0000000000000000000000000000000000868e0f';

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const pkey = process.env.HEDERA_OPERATOR_KEY;
  if (!pkey) throw new Error("Missing HEDERA_OPERATOR_KEY in .env.local");

  const signer = new ethers.Wallet(pkey.startsWith('0x') ? pkey : '0x' + pkey, provider);
  console.log(`Using signer: ${signer.address}`);

  const wagerContract = new ethers.Contract(WAGER_TOKEN, ERC20_ABI, signer);
  
  const balanceBefore = await wagerContract.balanceOf(signer.address);
  console.log(`Signer $WAGER Balance: ${ethers.formatUnits(balanceBefore, 8)}`);

  const amountToFund = ethers.parseUnits("100000", 8); // 100,000 WAGER

  if (balanceBefore < amountToFund) {
    throw new Error("Signer does not have enough $WAGER tokens to fund the pool.");
  }

  console.log(`Sending 100,000 $WAGER to WagerGames at ${WAGER_GAMES}...`);
  const tx = await wagerContract.transfer(WAGER_GAMES, amountToFund);
  console.log(`Tx hash: ${tx.hash}`);
  await tx.wait();
  console.log("Transfer confirmed.");

  const gamesBalance = await wagerContract.balanceOf(WAGER_GAMES);
  console.log(`New WagerGames Treasury Balance: ${ethers.formatUnits(gamesBalance, 8)} $WAGER`);
}

main().catch(console.error);
