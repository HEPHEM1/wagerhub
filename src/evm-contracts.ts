// Correct Hedera EVM addresses (derived from contract IDs: 0x + hex(num) padded to 20 bytes)
// 0.0.9289511  → hex(9289511) = 8DBF27 → 0x0000000000000000000000000000000000008DBF27
// 0.0.9290337  → hex(9290337) = 8DC261 → 0x0000000000000000000000000000000000008DC261
export const MOCK_WAGER_SWAP_POOL_ADDRESS = "0x0000000000000000000000000000000000008DBF27";
export const MOCK_WAGER_GAMES_ADDRESS     = "0x0000000000000000000000000000000000008DC261";

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
