// EVM specific constants and ABIs

export const EVM_WAGER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000868e0f";
export const EVM_USDC_ADDRESS = "0x00000000000000000000000000000000008f4312"; // 0.0.9388818 - Mock USDC (WagerHub)
export const EVM_USDT_ADDRESS = "0x00000000000000000000000000000000008f4310"; // 0.0.9388816 - Mock USDT (WagerHub)
export const EVM_TREASURY_ADDRESS = "0x42beff828729d60a84fc8dccda49a7614d0259f4"; // Treasury EVM Alias

export const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export const HTS_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000167";

export const HTS_ABI = [
  "function associateTokens(address account, address[] tokens) external returns (int64)"
];

export const HEDERA_TESTNET_CHAIN_ID = "0x128"; // 296
