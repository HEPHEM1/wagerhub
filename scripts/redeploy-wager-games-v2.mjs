/**
 * Compile + Deploy WagerGames using solc-js (no Hardhat dependency).
 * Redeploys with HTS self-association fix in constructor.
 * 
 * Run: node scripts/redeploy-wager-games-v2.mjs
 */
import { ethers } from "ethers";
import solc from "solc";
import { readFileSync } from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const WAGER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000868e0f"; // 0.0.8818191 $WAGER
const TREASURY_AMOUNT_WAGER = ethers.parseUnits("100000", 8); // 100,000 $WAGER

// Read OZ contracts from node_modules for imports
function findImports(importPath) {
  try {
    if (importPath.startsWith("@openzeppelin/")) {
      const fullPath = `./node_modules/${importPath}`;
      return { contents: readFileSync(fullPath, "utf8") };
    }
    return { error: "File not found" };
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const pkey = process.env.HEDERA_OPERATOR_KEY;
  if (!pkey) throw new Error("Missing HEDERA_OPERATOR_KEY in .env.local");

  const signer = new ethers.Wallet(pkey.startsWith("0x") ? pkey : "0x" + pkey, provider);
  console.log(`Deployer: ${signer.address}`);
  const bal = await provider.getBalance(signer.address);
  console.log(`HBAR balance: ${ethers.formatEther(bal)} HBAR`);

  // --- Compile ---
  console.log("\nCompiling WagerGames.sol with solc...");
  const source = readFileSync("./contracts/WagerGames.sol", "utf8");

  const input = {
    language: "Solidity",
    sources: { "WagerGames.sol": { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:", errors.map(e => e.message).join("\n"));
      process.exit(1);
    }
    // warnings only
    output.errors.forEach(e => console.warn("  ⚠️", e.message));
  }

  const contract = output.contracts["WagerGames.sol"]["WagerGames"];
  const abi = contract.abi;
  const bytecode = "0x" + contract.evm.bytecode.object;

  console.log(`✅ Compiled. Bytecode size: ${bytecode.length / 2} bytes`);

  // --- Deploy ---
  console.log("\nDeploying new WagerGames (with HTS self-association)...");
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const deployed = await factory.deploy(WAGER_TOKEN_ADDRESS, { gasLimit: 4_000_000 });

  console.log(`Tx hash: ${deployed.deploymentTransaction().hash}`);
  console.log("Waiting for confirmation...");
  await deployed.waitForDeployment();

  const newAddress = await deployed.getAddress();
  console.log(`\n✅ WagerGames deployed at EVM address: ${newAddress}`);

  // Wait for mirror node to index
  console.log("\nWaiting 8s for mirror node to index...");
  await new Promise(r => setTimeout(r, 8000));

  const mirrorRes = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${newAddress}`);
  const mirrorData = await mirrorRes.json();
  const hederaId = mirrorData?.account || "LOOKUP_FAILED";
  console.log(`Hedera native ID: ${hederaId}`);

  // --- Fund with $WAGER ---
  console.log(`\nFunding new contract with 100,000 $WAGER...`);
  const wagerToken = new ethers.Contract(WAGER_TOKEN_ADDRESS, [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
  ], signer);

  const deployerBal = await wagerToken.balanceOf(signer.address);
  console.log(`Deployer $WAGER balance: ${ethers.formatUnits(deployerBal, 8)}`);

  if (deployerBal < TREASURY_AMOUNT_WAGER) {
    console.warn("⚠️  Not enough $WAGER to fund 100k. Sending what we have...");
    const fundTx = await wagerToken.transfer(newAddress, deployerBal, { gasLimit: 1_000_000 });
    await fundTx.wait();
  } else {
    const fundTx = await wagerToken.transfer(newAddress, TREASURY_AMOUNT_WAGER, { gasLimit: 1_000_000 });
    console.log(`Fund tx: ${fundTx.hash}`);
    await fundTx.wait();
  }

  const newBal = await wagerToken.balanceOf(newAddress);
  console.log(`✅ New contract $WAGER balance: ${ethers.formatUnits(newBal, 8)}`);

  // Compute long-zero address from Hedera ID
  let longZeroAddress = "COMPUTE_FAILED";
  if (hederaId !== "LOOKUP_FAILED") {
    const parts = hederaId.split(".");
    const num = parseInt(parts[2]);
    longZeroAddress = "0x" + num.toString(16).padStart(40, "0");
  }

  console.log(`
===========================================================
✅ ALL DONE!

Update src/evm-contracts.ts with:
  MOCK_WAGER_GAMES_ADDRESS           = "${newAddress}"
  MOCK_WAGER_GAMES_LONG_ZERO_ADDRESS = "${longZeroAddress}"
  WAGER_GAMES_HEDERA_ID              = "${hederaId}"
===========================================================
`);
}

main().catch(err => {
  console.error("\n❌ FAILED:", err.shortMessage || err.message || err);
  process.exit(1);
});
