// Hedera EVM addresses: 0x + contract num in hex, left-padded to 40 chars
// 0.0.9289511 → 0x8DBF27 → 0x0000000000000000000000000000000000008dbf27 (but that's 41 hex chars)
// Correct: 9289511 decimal = 0x8DBF27 (6 hex), padded to 40 = 00000000000000000000000000000000008dbf27
// Correct: 9289511 decimal = 0x8DBF27 (6 hex), padded to 40 = 00000000000000000000000000000000008dbf27
export const MOCK_WAGER_SWAP_POOL_ADDRESS = "0xF2f0c10A1cc14B0F2a3E97dd6DC422a3CE9362F3"; // Hybrid Router
export const MOCK_WAGER_GAMES_ADDRESS     = "0xC68B5529Aeb410D56312ed1Bac6268e751D489cB";

export const WAGER_SWAP_POOL_HEDERA_ID = "0.0.9289511";
export const WAGER_GAMES_HEDERA_ID = "0.0.9290337";

export const WAGER_SWAP_POOL_ABI = [
  "function swapHbarForToken(string tokenOutSymbol, uint256 minAmountOut, bytes[] calldata priceUpdateData) external payable",
  "function swapTokenForHbar(string tokenInSymbol, uint256 amountIn, uint256 minAmountOut, bytes[] calldata priceUpdateData) external payable",
  "function swapTokenForToken(string tokenInSymbol, string tokenOutSymbol, uint256 amountIn, uint256 minAmountOut, bytes[] calldata priceUpdateData) external payable",
  "function withdrawLiquidity(address tokenAddress, uint256 amount) external"
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
