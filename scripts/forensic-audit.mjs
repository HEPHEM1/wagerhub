/**
 * FORENSIC AUDIT SCRIPT
 * Answers all 5 on-chain questions in one pass.
 */
import { ethers } from "ethers";
import https from "https";

const RPC_URL   = "https://testnet.hashio.io/api";
const ROUTER_ADDR = "0x04CC1d9Ba1ba05F5502bC06758C9933F42B85187";
const PYTH_ADDR   = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
const USDC_ADDR   = "0x0000000000000000000000000000000000008F6A"; // 0.0.9388818
const CORRECT_HBAR_FEED = "0x83eb07f0fdd8ecafaf9637cba5dc42299cf7e18985161d7ea948148b6c0e5a95";
// The WRONG id from frontend (line 448 of Wagerswap.tsx)
const FRONTEND_HBAR_FEED = "0xf2ef5dc6156e6cdccda6c315f3fc6de2bf37e9aecbc9b5efc51de98096c3e7c6";

const ROUTER_ABI = [
  "function hbarUsdPriceFeedId() external view returns (bytes32)",
  "function owner() external view returns (address)",
];
const PYTH_ABI = [
  "function getUpdateFee(bytes[] memory updateData) public view returns (uint256 feeAmount)",
];
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];
const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

// Helper to fetch HTTPS
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "Content-Type": "application/json" } }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`JSON parse fail: ${data.slice(0,200)}`)); }
      });
    }).on("error", reject);
  });
}

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("           WAGERHUB HYBRID ROUTER – FORENSIC AUDIT             ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // ─────────────────────────────────────────────────────────────────────────
  // Q1: RPC & CHAIN ID
  // ─────────────────────────────────────────────────────────────────────────
  console.log("─── Q1: RPC & Network Validation ───────────────────────────────");
  console.log(`RPC URL in use: ${RPC_URL}`);
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log(`chainId returned by RPC: ${chainId}`);
    console.log(`Expected Hedera Testnet chainId: 296`);
    if (chainId === 296) {
      console.log("✅ PASS – chainId matches Hedera Testnet (296).\n");
    } else {
      console.log(`❌ FAIL – Wrong network! Got ${chainId}, expected 296.\n`);
    }
  } catch (e) {
    console.log(`❌ RPC UNREACHABLE: ${e.message}\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Q2: CONTRACT STATE – hbarUsdPriceFeedId
  // ─────────────────────────────────────────────────────────────────────────
  console.log("─── Q2: Contract State Audit (hbarUsdPriceFeedId) ──────────────");
  console.log(`Router address: ${ROUTER_ADDR}`);
  let onChainFeedId = null;
  try {
    const router = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, provider);
    onChainFeedId = await router.hbarUsdPriceFeedId();
    console.log(`On-chain hbarUsdPriceFeedId:  ${onChainFeedId}`);
    console.log(`Expected (official Pyth):     ${CORRECT_HBAR_FEED}`);
    console.log(`Frontend Wagerswap.tsx feeds: ${FRONTEND_HBAR_FEED}`);
    if (onChainFeedId.toLowerCase() === CORRECT_HBAR_FEED.toLowerCase()) {
      console.log("✅ PASS – On-chain feed ID matches the correct official Pyth HBAR/USD ID.");
    } else {
      console.log("❌ FAIL – ON-CHAIN FEED ID IS WRONG!");
    }
    if (onChainFeedId.toLowerCase() === FRONTEND_HBAR_FEED.toLowerCase()) {
      console.log("🔴 CRITICAL BUG: Frontend is fetching Hermes with a DIFFERENT feed ID than what's on-chain!");
      console.log("   The priceUpdateData the frontend generates will be rejected by the contract.");
    } else if (onChainFeedId.toLowerCase() === CORRECT_HBAR_FEED.toLowerCase()) {
      console.log("🔴 CRITICAL BUG: Frontend Wagerswap.tsx line 448 still uses OLD feed ID: " + FRONTEND_HBAR_FEED);
      console.log("   The contract expects the CORRECT ID, but the frontend sends a payload for the WRONG ID.");
      console.log("   When the contract calls getPriceNoOlderThan(hbarUsdPriceFeedId), it will REVERT");
      console.log("   because the price update was submitted for a DIFFERENT feed ID.\n");
    }
  } catch (e) {
    console.log(`❌ Error reading contract state: ${e.message}\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Q3: TREASURY PERMISSION – Is router associated with USDC?
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n─── Q3: Treasury Permission Check (USDC association) ───────────");
  // Convert router address to Hedera account ID via mirror node
  try {
    const routerLower = ROUTER_ADDR.toLowerCase();
    const acctData = await fetchJson(`${MIRROR_BASE}/accounts/${routerLower}`);
    const routerHederaId = acctData?.account ?? "NOT FOUND";
    console.log(`Router Hedera Account ID: ${routerHederaId}`);

    // Check USDC balance directly (non-zero balance = associated)
    const usdcContract = new ethers.Contract(USDC_ADDR, ERC20_ABI, provider);
    const usdcBal = await usdcContract.balanceOf(ROUTER_ADDR);
    console.log(`Router USDC balance (raw): ${usdcBal.toString()} (${ethers.formatUnits(usdcBal, 6)} USDC)`);
    if (usdcBal > 0n) {
      console.log("✅ PASS – Router has a USDC balance → it is associated.");
    } else {
      // Check via mirror node token list
      const tokenData = await fetchJson(`${MIRROR_BASE}/accounts/${routerLower}/tokens?token.id=0.0.9388818&limit=1`);
      const isAssoc = (tokenData?.tokens?.length ?? 0) > 0;
      console.log(`Mirror node association for 0.0.9388818 (USDC): ${isAssoc}`);
      if (isAssoc) {
        console.log("✅ PASS – Router is associated with USDC (balance is 0 but relationship exists).");
      } else {
        console.log("❌ FAIL – Router is NOT associated with USDC. This will cause transfer failures.");
      }
    }

    // Also check HBAR balance
    const hbarWei = await provider.getBalance(ROUTER_ADDR);
    console.log(`Router HBAR balance: ${ethers.formatEther(hbarWei)} HBAR (wei representation)`);
  } catch (e) {
    console.log(`❌ Error during treasury check: ${e.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Q4: DECODE REVERT REASON – Simulate call and capture revert
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n─── Q4: Decoded Revert Reason (call simulation) ────────────────");
  try {
    // Simulate a swapHbarForToken(USDC, 0, []) with 0.1 HBAR and empty priceUpdateData
    const routerIface = new ethers.Interface([
      "function swapHbarForToken(string calldata tokenOutSymbol, uint256 minAmountOut, bytes[] calldata priceUpdateData) external payable",
    ]);
    const calldata = routerIface.encodeFunctionData("swapHbarForToken", [
      "USDC",
      0,
      [] // empty priceUpdateData — this should reveal the first revert hit
    ]);
    try {
      await provider.call({
        to: ROUTER_ADDR,
        data: calldata,
        value: ethers.parseEther("0.1"),
      });
      console.log("Simulation succeeded (no revert with empty priceUpdateData).");
    } catch (callErr) {
      // ethers.js wraps contract reverts in CALL_EXCEPTION
      if (callErr.data) {
        try {
          const decoded = ethers.toUtf8String("0x" + callErr.data.slice(10));
          console.log(`Revert reason (decoded): "${decoded}"`);
        } catch {
          console.log(`Raw revert data: ${callErr.data}`);
        }
      } else {
        console.log(`Revert error (no data): ${callErr.message}`);
      }
    }

    // Now simulate with a real Hermes payload for the CORRECT feed ID
    console.log(`\nNow simulating with REAL Hermes payload (correct feed ID: ${CORRECT_HBAR_FEED})`);
    try {
      const hermesUrl = `https://hermes-beta.pyth.network/v2/updates/price/latest?ids[]=${CORRECT_HBAR_FEED}`;
      const hermesData = await fetchJson(hermesUrl);
      const priceUpdateData = hermesData.binary.data.map(d => "0x" + d);
      console.log(`Hermes returned ${priceUpdateData.length} update(s), first 60 chars: ${priceUpdateData[0]?.slice(0,60)}...`);

      const calldataReal = routerIface.encodeFunctionData("swapHbarForToken", [
        "USDC",
        0,
        priceUpdateData
      ]);
      try {
        await provider.call({
          to: ROUTER_ADDR,
          data: calldataReal,
          value: ethers.parseEther("0.1"),
        });
        console.log("✅ Simulation SUCCEEDED with correct feed ID and real Hermes payload!");
      } catch (callErr2) {
        if (callErr2.data) {
          try {
            const decoded2 = ethers.toUtf8String("0x" + callErr2.data.slice(10));
            console.log(`Revert reason with correct payload: "${decoded2}"`);
          } catch {
            console.log(`Raw revert data (correct payload): ${callErr2.data}`);
          }
        } else {
          console.log(`Revert error with correct payload: ${callErr2.message}`);
        }
      }
    } catch(hermesErr) {
      console.log(`Could not fetch Hermes data for simulation: ${hermesErr.message}`);
    }
  } catch (e) {
    console.log(`Error during revert simulation: ${e.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Q5: HERMES PAYLOAD – Validate feed IDs on both endpoints
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n─── Q5: Hermes Payload Simulation ──────────────────────────────");
  const feedsToTest = [
    { name: "CORRECT_HBAR_FEED (on-chain)", id: CORRECT_HBAR_FEED },
    { name: "WRONG_FEED (frontend Wagerswap.tsx line 448)", id: FRONTEND_HBAR_FEED },
  ];
  for (const { name, id } of feedsToTest) {
    console.log(`\nTesting feed: ${name}`);
    console.log(`  ID: ${id}`);
    try {
      const url = `https://hermes-beta.pyth.network/v2/updates/price/latest?ids[]=${id}`;
      const data = await fetchJson(url);
      if (data.parsed && data.parsed.length > 0) {
        const p = data.parsed[0];
        console.log(`  ✅ Hermes-Beta ACCEPTS this ID.`);
        console.log(`     Price: $${(p.price.price * Math.pow(10, p.price.expo)).toFixed(6)}`);
        console.log(`     Conf:  ${p.price.conf}`);
        console.log(`     Feed returned ID: ${p.id}`);
        const payload = data.binary.data.map(d => "0x" + d);
        console.log(`     Payload hex (first 60): ${payload[0]?.slice(0,60)}...`);
      } else if (data.error) {
        console.log(`  ❌ Hermes-Beta REJECTS this ID. Error: ${data.error}`);
      } else {
        console.log(`  ⚠️  Unexpected response: ${JSON.stringify(data).slice(0,200)}`);
      }
    } catch (e) {
      console.log(`  ❌ Request failed: ${e.message}`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                      AUDIT COMPLETE                           ");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
