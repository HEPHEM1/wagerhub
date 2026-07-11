import { ethers } from "ethers";
const p = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
p.getBalance("0x42BEFf828729D60A84Fc8dcCDA49a7614D0259F4")
  .then(b => console.log("HBAR balance:", ethers.formatEther(b)))
  .catch(console.error);
