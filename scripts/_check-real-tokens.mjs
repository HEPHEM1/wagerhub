import { ethers } from 'ethers';

const USDT = '0x0000000000000000000000000000000000869322';
const USDC = '0x0000000000000000000000000000000000869323';

const abi = ['function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)'];

async function main() {
  const p = new ethers.JsonRpcProvider('https://testnet.hashio.io/api');
  const cUsdt = new ethers.Contract(USDT, abi, p);
  const cUsdc = new ethers.Contract(USDC, abi, p);
  try {
    const ts = await cUsdt.totalSupply();
    console.log('REAL USDT totalSupply:', ts.toString());
    const ts2 = await cUsdc.totalSupply();
    console.log('REAL USDC totalSupply:', ts2.toString());
  } catch (e) {
    console.error('Error:', e.message);
  }

  // Check deployer wallet balance
  const deployer = '0x42BEFf828729D60A84Fc8dcCDA49a7614D0259F4';
  try {
    const bal = await cUsdt.balanceOf(deployer);
    console.log('Deployer USDT balance:', ethers.formatUnits(bal, 6));
    const bal2 = await cUsdc.balanceOf(deployer);
    console.log('Deployer USDC balance:', ethers.formatUnits(bal2, 6));
  } catch(e) {}
}
main();
