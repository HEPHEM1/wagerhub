const fs = require('fs');
const text = fs.readFileSync('vercel_dump.html', 'utf8');
const queries = ['wager-lime', 'WAGER SWAP', 'w-full flex-shrink-0', 'WagerHub', 'Beta Season', 'WagerCredits'];
for (const q of queries) {
  const idx = text.indexOf(q);
  if (idx !== -1) {
    console.log('Found ' + q + ':', text.slice(idx - 100, idx + 200));
  } else {
    console.log('Not found: ' + q);
  }
}
