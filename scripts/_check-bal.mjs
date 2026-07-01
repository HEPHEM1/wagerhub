import { ethers } from 'ethers';
const p = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
const bal = await p.getBalance('0x42BEFf828729D60A84Fc8dcCDA49a7614D0259F4');
console.log('Signer HBAR (EVM):', ethers.formatEther(bal), 'HBAR');
const bal2 = await p.getBalance('0x3e41e403F3C070f6847e79D6fb470d9F39Aa24Ed');
console.log('Deployer HBAR    :', ethers.formatEther(bal2), 'HBAR');
