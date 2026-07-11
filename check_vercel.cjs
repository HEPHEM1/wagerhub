const https = require('https');
https.get('https://wagerhub.vercel.app/', (res) => {
  let html = '';
  res.on('data', c => html+=c);
  res.on('end', () => {
    const match = html.match(/src="(\/_next\/static\/chunks\/app\/page-[a-z0-9]+\.js)"/);
    if (match) {
      console.log('Found bundle:', match[1]);
      https.get('https://wagerhub.vercel.app' + match[1], (res2) => {
        let js = '';
        res2.on('data', c => js+=c);
        res2.on('end', () => {
          console.log('Contains strict wrapper:', js.includes('Strict wrapper'));
        });
      });
    } else {
      console.log('Bundle not found in HTML. Check vercel_dump.html directly.');
    }
  });
});
