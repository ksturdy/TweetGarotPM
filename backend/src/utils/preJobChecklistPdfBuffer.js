const { launchBrowser } = require('./launchBrowser');
const { generatePreJobChecklistPdfHtml } = require('./preJobChecklistPdfGenerator');

async function generatePreJobChecklistPdfBuffer(data, logoBase64 = '') {
  const html = generatePreJobChecklistPdfHtml(data, logoBase64);
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: false,
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error('Error generating Pre-Job Checklist PDF:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generatePreJobChecklistPdfBuffer };
