/**
 * Redeploys the WagerGames contract with HTS self-association in the constructor.
 * This is the root fix for the INVALID_ALLOWANCE_SPENDER_ID error on Hedera.
 * 
 * Run: node scripts/redeploy-wager-games.mjs
 */
import { ethers } from "ethers";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const WAGER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000868e0f"; // 0.0.8818191 $WAGER
const TREASURY_AMOUNT_WAGER = ethers.parseUnits("100000", 8); // 100,000 $WAGER to fund new contract

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const pkey = process.env.HEDERA_OPERATOR_KEY;
  if (!pkey) throw new Error("Missing HEDERA_OPERATOR_KEY in .env.local");

  const signer = new ethers.Wallet(pkey.startsWith("0x") ? pkey : "0x" + pkey, provider);
  console.log(`Deployer: ${signer.address}`);
  
  const hbarBalance = await provider.getBalance(signer.address);
  console.log(`HBAR balance: ${ethers.formatEther(hbarBalance)} HBAR`);

  // --- Compile the contract using solc or hardhat ---
  console.log("\nCompiling WagerGames.sol via hardhat...");
  execSync("npx hardhat compile", { stdio: "inherit" });

  // --- Load compiled artifact ---
  const artifactPath = "./artifacts/contracts/WagerGames.sol/WagerGames.json";
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  console.log("\nDeploying new WagerGames contract (with HTS self-association in constructor)...");
  
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(WAGER_TOKEN_ADDRESS, {
    gasLimit: 4_000_000
  });

  console.log(`Deployment tx hash: ${contract.deploymentTransaction().hash}`);
  console.log("Waiting for confirmation...");
  
  await contract.waitForDeployment();
  const newAddress = await contract.getAddress();
  
  console.log(`\n✅ WagerGames deployed at: ${newAddress}`);

  // --- Get the long-zero (Hedera native) representation ---
  // We need to look it up on the mirror node after deployment
  console.log("\nFetching Hedera native account ID from mirror node...");
  await new Promise(r => setTimeout(r, 5000)); // wait for mirror node to index
  
  const mirrorRes = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${newAddress}`);
  const mirrorData = await mirrorRes.json();
  const hederaId = mirrorData?.account || "unknown";
  console.log(`Hedera native ID: ${hederaId}`);

  // --- Fund the new contract with $WAGER tokens ---
  console.log(`\nFunding new WagerGames with 100,000 $WAGER...`);
  const wagerToken = new ethers.Contract(WAGER_TOKEN_ADDRESS, [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
  ], signer);

  const deployerBalance = await wagerToken.balanceOf(signer.address);
  console.log(`Deployer $WAGER balance: ${ethers.formatUnits(deployerBalance, 8)}`);

  if (deployerBalance < TREASURY_AMOUNT_WAGER) {
    console.warn("⚠️  Deployer doesn't have enough $WAGER to fund. Please fund manually.");
  } else {
    const fundTx = await wagerToken.transfer(newAddress, TREASURY_AMOUNT_WAGER, { gasLimit: 1_000_000 });
    console.log(`Fund tx: ${fundTx.hash}`);
    await fundTx.wait();
    console.log("✅ Funded successfully!");
  }

  // --- Output update needed ---
  console.log(`
===========================================================
✅ DEPLOYMENT COMPLETE

New WagerGames address: ${newAddress}
Hedera native ID:       ${hederaId}

NEXT STEPS - update src/evm-contracts.ts:
  MOCK_WAGER_GAMES_ADDRESS           = "${newAddress}"
  MOCK_WAGER_GAMES_LONG_ZERO_ADDRESS = <compute from ${hederaId}>
  WAGER_GAMES_HEDERA_ID              = "${hederaId}"
===========================================================
`);
}

main().catch(err => {
  console.error("\n❌ FAILED:", err.message || err);
  process.exit(1);
});
