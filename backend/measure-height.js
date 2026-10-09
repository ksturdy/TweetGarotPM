const { launchBrowser } = require('./src/utils/launchBrowser');
const path = require('path');
(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const htmlPath = path.resolve('../frontend/public/TITAN_Project_Scheduling_Guide.html').replace(/\/g, '/');
  await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 816, height: 10000 });
  const h = await page.evaluate(() => document.body.scrollHeight);
  console.log('Body height:', h, 'px');
  console.log('Letter content area (11in - 0.6in padding at 96dpi):', Math.round((11 - 0.6) * 96), 'px');
  console.log('Overflow:', h - Math.round((11 - 0.6) * 96), 'px');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
