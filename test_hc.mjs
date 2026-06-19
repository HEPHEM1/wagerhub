import { HashConnect } from 'hashconnect';

async function test() {
  try {
    const hc = new HashConnect('testnet', '0d8e72911e581a9079dd13f03f7ffb53', { name: 'Test', description: 'Test', url: 'https://wagerhub.vercel.app', icons: [] }, true);
    await hc.init();
    console.log('SUCCESS, URI:', hc.pairingString);
  } catch (err) {
    console.error('FAILED TO INIT:', err);
  }
}
test();
