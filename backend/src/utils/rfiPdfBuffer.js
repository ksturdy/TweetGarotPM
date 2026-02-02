const puppeteer = require('puppeteer');
const { generateRFIPdfHtml } = require('./rfiPdfGenerator');

/**
 * Generate a PDF buffer for an RFI
 * @param {Object} rfi - The RFI object
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateRfiPdfBuffer(rfi) {
  const html = generateRFIPdfHtml(rfi);
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({ width: 816, height: 1056 }); // Letter size at 96 DPI

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    // Wait a moment for any images to load
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
    console.error('Error generating PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateRfiPdfBuffer };
