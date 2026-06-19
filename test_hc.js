const { HashConnect } = require('hashconnect');
const hc = new HashConnect('testnet', '0d8e72911e581a9079dd13f03f7ffb53', { name: 'Test', description: 'Test', url: 'https://wagerhub.vercel.app', icons: [] }, true);
hc.init().then(() => console.log('SUCCESS', hc.pairingString)).catch(e => console.log('ERROR', e));
