// Hedera EVM addresses: 0x + contract num in hex, left-padded to 40 chars
// 0.0.9289511 → 0x8DBF27 → 0x0000000000000000000000000000000000008dbf27 (but that's 41 hex chars)
// Correct: 9289511 decimal = 0x8DBF27 (6 hex), padded to 40 = 00000000000000000000000000000000008dbf27
// Fixed Oracle Router (1e8 decimals for Hedera native msg.value)
export const MOCK_WAGER_SWAP_POOL_ADDRESS = "0x9E80E3a85224190e6b87b7aaa3B6205de4Ef9AC1"; 

export const MOCK_WAGER_GAMES_ADDRESS     = "0x31f659b77ba360729d1d0f2584de9be770ad3b42"; // NEW: 0.0.9507976 (with HTS self-association fix)
export const MOCK_WAGER_GAMES_LONG_ZERO_ADDRESS = "0x0000000000000000000000000000000000911488"; // 0.0.9507976

export const WAGER_SWAP_POOL_HEDERA_ID = "0.0.9289511";
export const WAGER_GAMES_HEDERA_ID = "0.0.9507976";

export const WAGER_SWAP_POOL_ABI = [
  // No-Oracle edition: priceUpdateData removed, no Pyth fee
  "function swapHbarForToken(string tokenOutSymbol, uint256 minAmountOut) external payable",
  "function swapTokenForHbar(string tokenInSymbol, uint256 amountIn, uint256 minAmountOut) external payable",
  "function swapTokenForToken(string tokenInSymbol, string tokenOutSymbol, uint256 amountIn, uint256 minAmountOut) external",
  "function setHbarUsdPrice(uint256 newPrice) external",
  "function hbarUsdPrice() external view returns (uint256)",
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
  const cleanBytes = new Uint8Array(hex.length / 2);
  for(let i = 0; i < hex.length; i += 2) {
    cleanBytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return cleanBytes;
}
