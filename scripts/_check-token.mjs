import { ethers } from 'ethers';

const USDT = '0x0000000000000000000000000000000000869922';
const USDC = '0x0000000000000000000000000000000000869923';
const POOL = '0xaBF06E296baF863CB0634f14D7b35BF336a5675e';

const abi = ['function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)'];

async function main() {
  const p = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const cUsdt = new ethers.Contract(USDT, abi, p);
  try {
    const ts = await cUsdt.totalSupply();
    console.log('USDT totalSupply:', ts.toString());
  } catch (e) {
    console.error('USDT Error:', e.message);
  }

  // Check deployer wallet balance
  const deployer = '0x42BEFf828729D60A84Fc8dcCDA49a7614D0259F4';
  try {
    const bal = await cUsdt.balanceOf(deployer);
    console.log('Deployer USDT balance:', bal.toString());
  } catch(e) {}
}
main();
