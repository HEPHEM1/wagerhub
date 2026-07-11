import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
const EVM_WAGER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000868e0f";
const MOCK_WAGER_GAMES_ADDRESS = "0x970f1388ec811155ecb072bbbc48c6be17c60522";
const playerAddress = "0xF8eced3b2E0d19776ef8546223c58707BDd26850".toLowerCase(); // lowercased to skip checksum validation

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)"
];

const contract = new ethers.Contract(EVM_WAGER_TOKEN_ADDRESS, ERC20_ABI, provider);

contract.allowance(playerAddress, MOCK_WAGER_GAMES_ADDRESS)
  .then(res => console.log(`ALLOWANCE: ${res.toString()}`))
  .catch(err => console.error(err));
