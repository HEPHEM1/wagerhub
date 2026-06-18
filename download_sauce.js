const fs = require('fs');
const https = require('https');

const url = 'https://coin-images.coingecko.com/coins/images/29119/large/sauce.png';
const dest = './public/tokens/sauce.png';

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.coingecko.com/'
  }
}, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to fetch: ${res.statusCode}`);
    return;
  }
  const file = fs.createWriteStream(dest);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Successfully downloaded sauce.png');
  });
}).on('error', (err) => {
  console.error('Error downloading:', err.message);
});
