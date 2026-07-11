/**
 * One-time admin script: Associate WagerGames contract with $WAGER HTS token.
 * In Hedera, any account/contract that receives/holds/is approved on an HTS token
 * must first be "associated" with it. Without this, approve() throws "INVALID_ALLOWANCE_SPENDER_ID".
 * 
 * Run: node scripts/associate-wagergames-wager-token.mjs
 */
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const WAGER_GAMES_LONG_ZERO = "0x00000000000000000000000000000000008e60d4"; // 0.0.9330900
const WAGER_TOKEN_ADDRESS   = "0x0000000000000000000000000000000000868e0f"; // 0.0.8818191 $WAGER
const HTS_PRECOMPILE        = "0x0000000000000000000000000000000000000167";

const HTS_ABI = [
  "function associateTokens(address account, address[] memory tokens) external returns (int64 responseCode)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const pkey = process.env.HEDERA_OPERATOR_KEY;
  if (!pkey) throw new Error("Missing HEDERA_OPERATOR_KEY in .env.local");

  const signer = new ethers.Wallet(pkey.startsWith("0x") ? pkey : "0x" + pkey, provider);
  console.log(`Using deployer signer: ${signer.address}`);

  const hts = new ethers.Contract(HTS_PRECOMPILE, HTS_ABI, signer);

  console.log(`\nAssociating WagerGames (${WAGER_GAMES_LONG_ZERO}) with $WAGER (${WAGER_TOKEN_ADDRESS})...`);

  const tx = await hts.associateTokens(
    WAGER_GAMES_LONG_ZERO,
    [WAGER_TOKEN_ADDRESS],
    { gasLimit: 1_000_000 }
  );

  console.log(`Tx hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`\n✅ SUCCESS! WagerGames is now associated with $WAGER.`);
  console.log(`   Block: ${receipt.blockNumber}`);
  console.log(`\nYou can now test the Penalty game - approve + playPenalty should work end to end.`);
}

main().catch(err => {
  console.error("\n❌ FAILED:", err.message || err);
  process.exit(1);
});
