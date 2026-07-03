// Convert Hedera token IDs to EVM addresses
const ids = { USDC: 9388818n, USDT: 9388816n, WAGER: 8818191n };
for (const [k, v] of Object.entries(ids)) {
  const addr = "0x" + v.toString(16).padStart(40, "0");
  console.log(k + ": " + addr);
}
