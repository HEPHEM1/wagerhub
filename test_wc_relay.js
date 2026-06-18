const WebSocket = require('ws');

const ws = new WebSocket('wss://relay.walletconnect.com?projectId=37016fd71f4d35906f67ec93aa5225ec');

ws.on('open', () => {
  console.log('Project ID is VALID! Connection opened.');
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('Project ID check failed:', err.message);
  process.exit(1);
});

ws.on('unexpected-response', (req, res) => {
  console.error(`Project ID check rejected with status: ${res.statusCode} ${res.statusMessage}`);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout. Relay did not respond.');
  process.exit(1);
}, 5000);
