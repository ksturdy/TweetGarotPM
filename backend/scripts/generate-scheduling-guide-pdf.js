/**
 * One-off script: generates TITAN_Project_Scheduling_Guide.pdf from the HTML source.
 * Run from /backend: node scripts/generate-scheduling-guide-pdf.js
 */
const path = require('path');
const { launchBrowser } = require('../src/utils/launchBrowser');

async function run() {
  const htmlPath = path.resolve(__dirname, '../../frontend/public/TITAN_Project_Scheduling_Guide.html');
  const pdfPath  = path.resolve(__dirname, '../../frontend/public/TITAN_Project_Scheduling_Guide.pdf');

  console.log('Launching browser…');
  const browser = await launchBrowser();
  const page = await browser.newPage();

  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  await browser.close();
  console.log(`PDF written to: ${pdfPath}`);
}

run().catch((err) => { console.error(err); process.exit(1); });
