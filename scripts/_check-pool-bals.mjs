import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const POOL = '0xaBF06E296baF863CB0634f14D7b35BF336a5675e';
const USDT = '0x0000000000000000000000000000000000869922';
const USDC = '0x0000000000000000000000000000000000869923';

const abi = ['function balanceOf(address) view returns (uint256)'];

async function main() {
  const p = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const balH = await p.getBalance(POOL);
  const cUsdt = new ethers.Contract(USDT, abi, p);
  const cUsdc = new ethers.Contract(USDC, abi, p);
  
  const bUsdt = await cUsdt.balanceOf(POOL);
  const bUsdc = await cUsdc.balanceOf(POOL);
  
  console.log('HBAR:', ethers.formatEther(balH));
  console.log('USDT:', ethers.formatUnits(bUsdt, 6));
  console.log('USDC:', ethers.formatUnits(bUsdc, 6));
}
main().catch(console.error);
