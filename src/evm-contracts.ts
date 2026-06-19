// Mock Addresses for the Smart Contracts (will be replaced by actual addresses after deployment)
export const MOCK_WAGER_SWAP_POOL_ADDRESS = "0x0000000000000000000000000000000000868e1a";
export const MOCK_WAGER_GAMES_ADDRESS = "0x0000000000000000000000000000000000868e1b";

export const WAGER_SWAP_POOL_ABI = [
  "function swapHbarForWager() external payable",
  "function withdrawHbar() external",
  "function withdrawWager(uint256 amount) external"
];

export const WAGER_GAMES_ABI = [
  "function playPenaltyShootout(uint256 betAmount) external",
  "function withdrawLiquidity(uint256 amount) external"
];
