const https = require('https');
https.get('https://wagerhub.vercel.app/', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => require('fs').writeFileSync('vercel_dump.html', data));
});
