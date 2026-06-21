// Mock Addresses for the Smart Contracts (will be replaced by actual addresses after deployment)
export const MOCK_WAGER_SWAP_POOL_ADDRESS = "0xd6E23b3985bF551B32dA7ae4Bb4aFa8907115706";
export const MOCK_WAGER_GAMES_ADDRESS = "0xbADdcec86E8D06258C8daE21f76428692A008Dc7";

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
