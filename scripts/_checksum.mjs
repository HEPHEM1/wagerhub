import { ethers } from 'ethers';
// Output the EIP-55 checksummed version of the new pool address
const addr = '0xf41c0b07bf487e2d6e5e14e17d1c7d0ee5a1e78b'; // lowercase
console.log('Checksummed:', ethers.getAddress(addr));
