const { launchBrowser } = require('./launchBrowser');
const { generateSellSheetPdfHtml } = require('./sellSheetPdfGenerator');

async function generateSellSheetPdfBuffer(sellSheet, images, logoBase64) {
  const html = generateSellSheetPdfHtml(sellSheet, images, logoBase64);
  let browser = null;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating sell sheet PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateSellSheetPdfBuffer };
