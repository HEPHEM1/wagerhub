/**
 * Compiles WagerGames.sol using the solc bundled inside Hardhat's own node_modules.
 * This avoids calling `npx hardhat` (which hangs on this system).
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import { resolve } from "path";

// Use the solc bundled inside hardhat's own dependencies
const require = createRequire(import.meta.url);

// Try to find solc inside hardhat's node_modules
const hardhatSolcPath = resolve("./node_modules/hardhat/node_modules/solc/index.js");
const fallbackSolcPath = resolve("./node_modules/solc/index.js");

let solc;
try {
  solc = require(hardhatSolcPath);
  console.log("Using solc from hardhat/node_modules/solc");
} catch {
  try {
    solc = require(fallbackSolcPath);
    console.log("Using solc from node_modules/solc");
  } catch (e) {
    console.error("Could not find solc:", e.message);
    process.exit(1);
  }
}

function findImports(importPath) {
  try {
    if (importPath.startsWith("@openzeppelin/")) {
      return { contents: readFileSync(`./node_modules/${importPath}`, "utf8") };
    }
  } catch (e) {}
  return { error: "File not found" };
}

const source = readFileSync("./contracts/WagerGames.sol", "utf8");

const input = {
  language: "Solidity",
  sources: { "WagerGames.sol": { content: source } },
  settings: {
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    optimizer: { enabled: true, runs: 200 },
  },
};

console.log("Compiling...");
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

const errors = (output.errors || []).filter(e => e.severity === "error");
if (errors.length > 0) {
  console.error("Compilation errors:");
  errors.forEach(e => console.error(e.formattedMessage));
  process.exit(1);
}

const warnings = (output.errors || []).filter(e => e.severity === "warning");
warnings.forEach(w => console.warn("⚠️ ", w.message));

const contract = output.contracts["WagerGames.sol"]["WagerGames"];
console.log("\n✅ COMPILE SUCCESS");
console.log("ABI:", JSON.stringify(contract.abi).slice(0, 100) + "...");
console.log("Bytecode length:", contract.evm.bytecode.object.length / 2, "bytes");
console.log("\nBYTECODE_START");
console.log(contract.evm.bytecode.object);
console.log("BYTECODE_END");
console.log("\nABI_START");
console.log(JSON.stringify(contract.abi));
console.log("ABI_END");
