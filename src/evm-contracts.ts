// Hedera EVM addresses: 0x + contract num in hex, left-padded to 40 chars
// 0.0.9289511 → 0x8DBF27 → 0x0000000000000000000000000000000000008dbf27 (but that's 41 hex chars)
// Correct: 9289511 decimal = 0x8DBF27 (6 hex), padded to 40 = 00000000000000000000000000000000008dbf27
export const MOCK_WAGER_SWAP_POOL_ADDRESS = "0x970F1388ec811155ECB072BbbC48C6bE17C60522";
export const MOCK_WAGER_GAMES_ADDRESS     = "0x0EAe037F84Aa46804eaeeC146E3CB12391B875b4";

export const WAGER_SWAP_POOL_HEDERA_ID = "0.0.9289511";
export const WAGER_GAMES_HEDERA_ID = "0.0.9290337";

export const WAGER_SWAP_POOL_ABI = [
  "function swapHbarForWager() external payable",
  "function swapTokenForHbar(string tokenIn, uint256 amountIn) external",
  "function swapTokenForToken(string tokenIn, string tokenOut, uint256 amountIn) external",
  "function withdrawHbar() external",
  "function withdrawWager(uint256 amount) external"
];

export const WAGER_GAMES_ABI = [
  "function playPenalty(uint256 betAmount) external",
  "function playMysteryField(uint256 betAmount) external",
  "function playRPSZeroTrust(uint256 betAmount) external",
  "function playGravityDrop(uint256 betAmount) external",
  "function playTrendRider(uint256 betAmount) external",
  "function playBlindLoot(uint256 betAmount) external",
  "function withdrawLiquidity(uint256 amount) external"
];

export function getCleanFunctionBytes(hexString: string): Uint8Array {
  const hex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  const cleanBytes = new window.Uint8Array(hex.length / 2);
  for(let i = 0; i < hex.length; i += 2) {
    cleanBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return cleanBytes;
}
