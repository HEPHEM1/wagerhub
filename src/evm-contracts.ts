// Mock Addresses for the Smart Contracts (will be replaced by actual addresses after deployment)
export const MOCK_WAGER_SWAP_POOL_ADDRESS = "0xd6E23b3985bF551B32dA7ae4Bb4aFa8907115706";
export const MOCK_WAGER_GAMES_ADDRESS = "0xbADdcec86E8D06258C8daE21f76428692A008Dc7";

export const WAGER_SWAP_POOL_ABI = [
  "function swapHbarForToken(string tokenOut) external payable",
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
