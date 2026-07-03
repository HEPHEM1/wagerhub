/**
 * Deep-decode Pyth custom error 0x2acbe915
 * and simulate the Pyth updatePriceFeeds call directly
 * to find the real revert inside the Pyth contract.
 */
import { ethers } from "ethers";
import https from "https";

const RPC      = "https://testnet.hashio.io/api";
const ROUTER   = "0xC4093DB93CbC271d9EE8A667846d8dE79C92e77B";
const PYTH     = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
const FEED_ID  = "0xf2ef5dc6156e6cdccda6c315f3fc6de2bf37e9aecbc9b5efc51de98096c3e7c6";
const HERMES   = `https://hermes-beta.pyth.network/v2/updates/price/latest?ids[]=${FEED_ID}`;

// Known Pyth custom errors (from @pythnetwork/pyth-sdk-solidity)
const PYTH_ERRORS = {
  "0x025dbdd4": "InvalidArgument()",
  "0x2acbe915": "PriceFeedNotFoundWithinRange() — price too OLD or NOT FOUND in the VAA update",
  "0xcd21db4f": "PriceFeedNotFound()",
  "0x4b6a7060": "InvalidGovernanceMessage()",
  "0xe69ffece": "InvalidUpdateDataSource()",
  "0x5945ea56": "InvalidUpdateData()",
  "0x6e0c9a58": "InsufficientFee()",
  "0xa1dc4455": "StalePrice()",
  "0xea05dd49": "NoFreshUpdate()",
  "0x19abf40e": "InvalidWormholeVaa()",
  "0xfe6c78fb": "InvalidGovernanceTarget()",
  "0x4fb7b217": "InvalidGovernanceDataSource()",
  "0x9d55a902": "OldGovernanceMessage()",
};

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

async function run() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("         PYTH ERROR DECODER & SIMULATION DIAGNOSTIC        ");
  console.log("════════════════════════════════════════════════════════════\n");

  const provider = new ethers.JsonRpcProvider(RPC);

  // ─── Decode revert 0x2acbe915 ────────────────────────────────────────
  console.log("── Decoding raw revert 0x2acbe915 ───────────────────────");
  const meaning = PYTH_ERRORS["0x2acbe915"] ?? "Unknown error";
  console.log(`Selector 0x2acbe915 = ${meaning}`);
  console.log();

  // ─── Fetch fresh payload ─────────────────────────────────────────────
  console.log("── Fetching Hermes-Beta payload ──────────────────────────");
  const { status, body } = await httpsGet(HERMES);
  if (status !== 200 || !body?.binary?.data) {
    console.log(`❌ Hermes failed (${status}): ${JSON.stringify(body).slice(0,200)}`);
    process.exit(1);
  }
  const priceUpdateData = body.binary.data.map(d => "0x" + d);
  const parsed = body.parsed?.[0];
  const ageSeconds = parsed ? Math.floor(Date.now() / 1000) - parsed.price.publish_time : "?";
  console.log(`✅ Payload fetched. Age: ${ageSeconds}s`);
  if (parsed) {
    console.log(`   Price: $${(parsed.price.price * Math.pow(10, parsed.price.expo)).toFixed(6)}`);
    console.log(`   Publish time: ${new Date(parsed.price.publish_time * 1000).toISOString()}`);
  }
  console.log();

  // ─── Simulate updatePriceFeeds directly on Pyth contract ─────────────
  console.log("── Direct Pyth.updatePriceFeeds() simulation ────────────");
  const PYTH_ABI = [
    "function updatePriceFeeds(bytes[] calldata updateData) external payable",
    "function getUpdateFee(bytes[] memory updateData) public view returns (uint256 feeAmount)",
    "function getPriceUnsafe(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime) price)",
    "function getPriceNoOlderThan(bytes32 id, uint age) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime) price)",
    "function getValidTimePeriod() external view returns (uint validTimePeriod)",
  ];
  const pythContract = new ethers.Contract(PYTH, PYTH_ABI, provider);
  
  const fee = await pythContract.getUpdateFee(priceUpdateData);
  console.log(`Pyth fee: ${fee} wei`);

  // Simulate Pyth.updatePriceFeeds directly
  const pythIface = new ethers.Interface(PYTH_ABI);
  try {
    await provider.call({
      to: PYTH,
      data: pythIface.encodeFunctionData("updatePriceFeeds", [priceUpdateData]),
      value: fee,
    });
    console.log("✅ Pyth.updatePriceFeeds simulation PASSED directly");
  } catch (e) {
    const data = e.data ?? "";
    const knownErr = PYTH_ERRORS[data.slice(0, 10)] ?? `Unknown: ${data.slice(0,10)}`;
    console.log(`❌ Pyth.updatePriceFeeds reverted: ${knownErr}`);
    console.log(`   Raw data: ${data}`);
  }
  console.log();

  // ─── Try getPriceUnsafe (no age check) ────────────────────────────────
  console.log("── Read price without age check (getPriceUnsafe) ────────");
  try {
    const priceUnsafe = await pythContract.getPriceUnsafe(FEED_ID);
    console.log(`getPriceUnsafe OK:`);
    console.log(`  price       : ${priceUnsafe.price}`);
    console.log(`  expo        : ${priceUnsafe.expo}`);
    console.log(`  publishTime : ${priceUnsafe.publishTime} (${new Date(Number(priceUnsafe.publishTime) * 1000).toISOString()})`);
    const priceAge = Math.floor(Date.now() / 1000) - Number(priceUnsafe.publishTime);
    console.log(`  Current age : ${priceAge}s`);
    if (priceAge > 60) {
      console.log(`  ⚠️  STALE: ${priceAge}s old — getPriceNoOlderThan(60) will REVERT even after updatePriceFeeds`);
      console.log(`            Reason: Pyth's Hedera Testnet contract may not actually process the VAA update correctly.`);
    }
  } catch(e) {
    console.log(`getPriceUnsafe failed: ${e.message}`);
  }

  // ─── Try getPriceNoOlderThan (60s) ────────────────────────────────────
  console.log();
  console.log("── Read price WITH age check (getPriceNoOlderThan 60s) ──");
  try {
    const price60 = await pythContract.getPriceNoOlderThan(FEED_ID, 60);
    console.log(`✅ getPriceNoOlderThan(60) PASSED:`);
    console.log(`  price: ${price60.price}, expo: ${price60.expo}`);
  } catch(e) {
    const data = e.data ?? "";
    const known = PYTH_ERRORS[data.slice(0,10)] ?? e.message;
    console.log(`❌ getPriceNoOlderThan(60) FAILED: ${known}`);
    console.log(`   This confirms: the Pyth Testnet contract does NOT have a fresh price stored on-chain.`);
    console.log(`   The updatePriceFeeds call must succeed to push data on-chain first.`);
  }

  // ─── Check getValidTimePeriod ─────────────────────────────────────────
  console.log();
  console.log("── Pyth.getValidTimePeriod() ─────────────────────────────");
  try {
    const vtp = await pythContract.getValidTimePeriod();
    console.log(`Valid time period: ${vtp}s`);
  } catch(e) {
    console.log(`Failed: ${e.message}`);
  }

  // ─── Try router call with fresh payload IMMEDIATELY ──────────────────
  console.log();
  console.log("── Final: Simulate router.swapHbarForToken (fresh payload) ─");
  const routerIface = new ethers.Interface([
    "function swapHbarForToken(string calldata tokenOutSymbol, uint256 minAmountOut, bytes[] calldata priceUpdateData) external payable",
  ]);
  const totalValue = ethers.parseEther("15") + fee;
  try {
    await provider.call({
      to: ROUTER,
      data: routerIface.encodeFunctionData("swapHbarForToken", ["USDC", 0n, priceUpdateData]),
      value: totalValue,
    });
    console.log("✅ Router simulation PASSED — swap would succeed on-chain!");
  } catch (e) {
    const data = e.data ?? "";
    const known = PYTH_ERRORS[data.slice(0,10)];
    if (known) {
      console.log(`❌ Router reverted with Pyth error: ${known}`);
    } else if (data.startsWith("0x08c379a0")) {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10));
      console.log(`❌ Router require() reverted: "${decoded[0]}"`);
    } else {
      console.log(`❌ Router reverted: ${data || e.message}`);
    }
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log("                      ANALYSIS COMPLETE                    ");
  console.log("════════════════════════════════════════════════════════════\n");
}

run().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
