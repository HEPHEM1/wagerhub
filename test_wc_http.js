const https = require('https');

https.get('https://relay.walletconnect.com/?projectId=37016fd71f4d35906f67ec93aa5225ec', (res) => {
  console.log('Status:', res.statusCode);
  if (res.statusCode === 101 || res.statusCode === 426) {
    console.log('Project ID is valid! (Upgrade required means the relay accepted the ID and expects a WebSocket).');
  } else if (res.statusCode === 401 || res.statusCode === 403) {
    console.log('Project ID is REJECTED (Unauthorized/Forbidden).');
  } else {
    console.log('Other response:', res.statusMessage);
  }
}).on('error', (e) => {
  console.error(e);
});
