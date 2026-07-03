import { ethers } from "ethers";
const p = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
const bal = await p.getBalance("0x42BEFf828729D60A84Fc8dcCDA49a7614D0259F4");
console.log("Deployer balance:", ethers.formatEther(bal), "HBAR");
