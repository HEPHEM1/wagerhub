// EVM specific constants and ABIs

export const EVM_WAGER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000868e0f";
export const EVM_TREASURY_ADDRESS = "0x0000000000000000000000000000000000868e06";

export const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export const HEDERA_TESTNET_CHAIN_ID = "0x128"; // 296
