import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
const contract = new ethers.Contract('0x970f1388ec811155ecb072bbbc48c6be17c60522', ['function wagerToken() external view returns (address)'], provider);
contract.wagerToken().then(console.log);
