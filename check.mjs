import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  console.log('Navigating to wagerhub.vercel.app...');
  await page.goto('https://wagerhub.vercel.app', { waitUntil: 'networkidle2' });
  
  const headerExists = await page.evaluate(() => !!document.querySelector('header'));
  console.log('HEADER_EXISTS:', headerExists);
  
  if (!headerExists) {
    console.log('Header not found! Dumping DOM structure...');
    const html = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('debug.html', html);
  }
  
  await browser.close();
})();
