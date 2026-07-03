/**
 * ORACLE ROUTE DEEP DIAGNOSTIC
 * Simulates the exact HBAR->USDC swap call the frontend makes,
 * decodes the revert reason, and checks every require() condition.
 */
import { ethers } from "ethers";
import https from "https";

const RPC       = "https://testnet.hashio.io/api";
const ROUTER    = "0xC4093DB93CbC271d9EE8A667846d8dE79C92e77B";
const PYTH      = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
const USDC_EVM  = "0x0000000000000000000000000000000000008F6A"; // 0.0.9388818
const USDT_EVM  = "0x000000000000000000000000000000000000906A"; // may differ
const WAGER_EVM = "0x0000000000000000000000000000000000869FCF"; // 0.0.8818191
const FEED_ID   = "0xf2ef5dc6156e6cdccda6c315f3fc6de2bf37e9aecbc9b5efc51de98096c3e7c6";
const HERMES    = `https://hermes-beta.pyth.network/v2/updates/price/latest?ids[]=${FEED_ID}`;
const SWAP_HBAR = "15"; // 15 HBAR — matching what the screenshot shows

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "Accept": "application/json" } }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    }).on("error", reject);
  });
}

function decodeRevert(err) {
  // Try standard Error(string) selector: 0x08c379a0
  const data = err.data ?? err.revert?.args?.[0] ?? null;
  if (!data) return `No revert data. Message: ${err.message}`;
  if (data.startsWith("0x08c379a0")) {
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10));
      return `require() reverted: "${decoded[0]}"`;
    } catch { /**/ }
  }
  if (data.startsWith("0x4e487b71")) {
    const code = parseInt(data.slice(-2), 16);
    const PANIC = { 1:"assert", 17:"overflow", 18:"divide by zero", 33:"bad enum", 34:"bad storage", 51:"empty array pop", 81:"out of bounds", 97:"too much memory" };
    return `Panic(${code}): ${PANIC[code] ?? "unknown panic"}`;
  }
  return `Raw revert data: ${data}`;
}

async function run() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("         ORACLE ROUTE DEEP DIAGNOSTIC  (15 HBAR → USDC)    ");
  console.log("════════════════════════════════════════════════════════════\n");

  const provider = new ethers.JsonRpcProvider(RPC);

  // ─── 1. Verify new contract is deployed ─────────────────────────────
  console.log("── 1. Contract Verification ──────────────────────────────");
  const code = await provider.getCode(ROUTER);
  if (code === "0x") {
    console.log(`❌ FATAL: No contract at ${ROUTER}`);
    process.exit(1);
  }
  console.log(`✅ Contract deployed at ${ROUTER} (${code.length / 2 - 1} bytes)\n`);

  const ROUTER_ABI = [
    "function hbarUsdPriceFeedId() external view returns (bytes32)",
    "function usdcToken() external view returns (address)",
    "function usdtToken() external view returns (address)",
    "function wagerToken() external view returns (address)",
    "function pyth() external view returns (address)",
    "function swapHbarForToken(string calldata tokenOutSymbol, uint256 minAmountOut, bytes[] calldata priceUpdateData) external payable",
  ];
  const PYTH_ABI = [
    "function getUpdateFee(bytes[] memory updateData) public view returns (uint256 feeAmount)",
    "function getValidTimePeriod() external view returns (uint validTimePeriod)",
  ];
  const ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function symbol() external view returns (string)",
  ];

  const router = new ethers.Contract(ROUTER, ROUTER_ABI, provider);
  const pyth   = new ethers.Contract(PYTH, PYTH_ABI, provider);

  // ─── 2. Read all storage slots ───────────────────────────────────────
  console.log("── 2. On-chain Contract State ────────────────────────────");
  const [feedId, usdcAddr, usdtAddr, wagerAddr, pythAddr] = await Promise.all([
    router.hbarUsdPriceFeedId(),
    router.usdcToken(),
    router.usdtToken(),
    router.wagerToken(),
    router.pyth(),
  ]);
  console.log(`hbarUsdPriceFeedId : ${feedId}`);
  console.log(`Expected feed      : ${FEED_ID}`);
  console.log(`Feed match         : ${feedId.toLowerCase() === FEED_ID.toLowerCase() ? "✅ YES" : "❌ NO — MISMATCH"}`);
  console.log(`usdcToken          : ${usdcAddr}  (expected: ${USDC_EVM})`);
  console.log(`usdtToken          : ${usdtAddr}`);
  console.log(`wagerToken         : ${wagerAddr}`);
  console.log(`pyth               : ${pythAddr}  (expected: ${PYTH})\n`);

  // ─── 3. Treasury balances ────────────────────────────────────────────
  console.log("── 3. Treasury Vault Balances ────────────────────────────");
  const hbarWei = await provider.getBalance(ROUTER);
  console.log(`HBAR  : ${ethers.formatEther(hbarWei)} HBAR`);
  const usdcC = new ethers.Contract(usdcAddr, ERC20_ABI, provider);
  const usdtC = new ethers.Contract(usdtAddr, ERC20_ABI, provider);
  const wagerC = new ethers.Contract(wagerAddr, ERC20_ABI, provider);
  const [usdcBal, usdtBal, wagerBal] = await Promise.all([
    usdcC.balanceOf(ROUTER).catch(() => 0n),
    usdtC.balanceOf(ROUTER).catch(() => 0n),
    wagerC.balanceOf(ROUTER).catch(() => 0n),
  ]);
  console.log(`USDC  : ${ethers.formatUnits(usdcBal, 6)} USDC`);
  console.log(`USDT  : ${ethers.formatUnits(usdtBal, 6)} USDT`);
  console.log(`WAGER : ${ethers.formatUnits(wagerBal, 8)} WAGER`);
  if (usdcBal === 0n) console.log("🔴 WARNING: USDC balance is ZERO — treasury may not be associated");
  console.log();

  // ─── 4. Fetch Hermes payload ─────────────────────────────────────────
  console.log("── 4. Hermes-Beta Payload ────────────────────────────────");
  let priceUpdateData = [];
  let pythFee = 0n;
  try {
    console.log(`Fetching: ${HERMES}`);
    const { status, body } = await httpsGet(HERMES);
    console.log(`HTTP status: ${status}`);
    if (status !== 200 || !body?.binary?.data) {
      console.log(`❌ Hermes error: ${JSON.stringify(body).slice(0, 300)}`);
      process.exit(1);
    }
    priceUpdateData = body.binary.data.map(d => "0x" + d);
    const parsed = body.parsed?.[0];
    console.log(`✅ Hermes returned ${priceUpdateData.length} update(s)`);
    if (parsed) {
      const price = parsed.price.price * Math.pow(10, parsed.price.expo);
      console.log(`   HBAR/USD price : $${price.toFixed(6)}`);
      console.log(`   Publish time   : ${new Date(parsed.price.publish_time * 1000).toISOString()}`);
      const ageSeconds = Math.floor(Date.now() / 1000) - parsed.price.publish_time;
      console.log(`   Age            : ${ageSeconds}s (contract max age: 60s)`);
      if (ageSeconds > 60) {
        console.log(`   ⚠️  Price is ${ageSeconds}s old — getPriceNoOlderThan(60) will REVERT if update call fails`);
      }
    }
    pythFee = await pyth.getUpdateFee(priceUpdateData);
    console.log(`   Pyth update fee: ${ethers.formatEther(pythFee)} HBAR (${pythFee} wei)`);
  } catch (e) {
    console.log(`❌ Error fetching Hermes: ${e.message}`);
    process.exit(1);
  }
  console.log();

  // ─── 5. Compute exact msg.value the frontend sends ──────────────────
  console.log("── 5. Frontend msg.value Calculation ────────────────────");
  const payAmountWei = ethers.parseEther(SWAP_HBAR);
  const totalMsgValue = payAmountWei + pythFee;
  console.log(`payAmount (HBAR)   : ${SWAP_HBAR} HBAR = ${payAmountWei} wei`);
  console.log(`pythFee            : ${pythFee} wei`);
  console.log(`total msg.value    : ${totalMsgValue} wei = ${ethers.formatEther(totalMsgValue)} HBAR`);
  console.log(`Contract check     : msgValue (${totalMsgValue}) > fee (${pythFee})? ${totalMsgValue > pythFee ? "✅ YES" : "❌ NO"}`);
  const swapHbarAmount = totalMsgValue - pythFee;
  console.log(`swapHbarAmount     : ${swapHbarAmount} wei = ${ethers.formatEther(swapHbarAmount)} HBAR`);
  // Compute expected USDC out (6 decimals, HBAR is 1e18)
  // priceOfOneHbarInStables = price * 10^(6 - abs(expo))  — rough estimate
  console.log();

  // ─── 6. Simulate the EXACT call ─────────────────────────────────────
  console.log("── 6. Call Simulation (staticCall) ──────────────────────");
  const iface = new ethers.Interface([
    "function swapHbarForToken(string calldata tokenOutSymbol, uint256 minAmountOut, bytes[] calldata priceUpdateData) external payable",
  ]);

  // 6a: Empty priceUpdateData (should fail at Pyth fee check or updatePriceFeeds)
  console.log("6a. Simulate with EMPTY priceUpdateData:");
  try {
    await provider.call({ to: ROUTER, data: iface.encodeFunctionData("swapHbarForToken", ["USDC", 0, []]), value: payAmountWei });
    console.log("    ✅ Simulation passed (unexpected)");
  } catch (e) { console.log(`    ${decodeRevert(e)}`); }

  // 6b: Real payload, fee included in msg.value
  console.log("6b. Simulate with REAL Hermes payload + fee included:");
  try {
    await provider.call({ to: ROUTER, data: iface.encodeFunctionData("swapHbarForToken", ["USDC", 0, priceUpdateData]), value: totalMsgValue });
    console.log("    ✅ Simulation PASSED — swap should work!");
  } catch (e) { console.log(`    ${decodeRevert(e)}`); }

  // 6c: Real payload, fee NOT included (only payAmount sent)
  console.log("6c. Simulate with REAL Hermes payload, NO fee (only payAmount):");
  try {
    await provider.call({ to: ROUTER, data: iface.encodeFunctionData("swapHbarForToken", ["USDC", 0, priceUpdateData]), value: payAmountWei });
    console.log("    ✅ Simulation PASSED");
  } catch (e) { console.log(`    ${decodeRevert(e)}`); }

  // 6d: Real payload, zero msg.value
  console.log("6d. Simulate with REAL Hermes payload, ZERO msg.value:");
  try {
    await provider.call({ to: ROUTER, data: iface.encodeFunctionData("swapHbarForToken", ["USDC", 0, priceUpdateData]), value: 0n });
    console.log("    ✅ Simulation PASSED");
  } catch (e) { console.log(`    ${decodeRevert(e)}`); }

  // 6e: Check USDC token address match
  console.log("\n6e. Does usdcAddr returned by contract match the known USDC EVM?");
  console.log(`    Contract usdcToken: ${usdcAddr}`);
  console.log(`    Known USDC EVM    : ${USDC_EVM}`);
  if (usdcAddr.toLowerCase() !== USDC_EVM.toLowerCase()) {
    console.log("    🔴 MISMATCH — the contract was deployed with the WRONG USDC token address!");
    console.log("    This means USDC transfers will always fail → CONTRACT_REVERT_EXECUTED");
  } else {
    console.log("    ✅ Match");
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("                    DIAGNOSTIC COMPLETE                    ");
  console.log("════════════════════════════════════════════════════════════\n");
}

run().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
