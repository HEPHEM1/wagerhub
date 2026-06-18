async function test() {
  const { HashConnect } = await import('hashconnect');
  const { LedgerId } = await import('@hashgraph/sdk');
  const hc = new HashConnect(LedgerId.TESTNET, '37016fd71f4d35906f67ec93aa5225ec', {name: 'test', description: 'test', icons: [], url: 'http://localhost'}, false);
  console.log('KEYS BEFORE:', Object.keys(hc));
  try {
    await hc.init();
    console.log('KEYS AFTER:', Object.keys(hc));
    console.log('_signClient:', !!(hc)._signClient);
    console.log('signClient:', !!(hc).signClient);
  } catch (e) {
    console.log('INIT ERROR:', e.message);
  }
}
test();
