const puppeteer = require('puppeteer');
const { generatePhaseSchedulePdfHtml } = require('./phaseSchedulePdfGenerator');

/**
 * Generate a PDF buffer for the Phase Schedule (landscape Letter).
 * @param {Object} data - { items, project, view, mode }
 * @returns {Promise<Buffer>}
 */
async function generatePhaseSchedulePdfBuffer(data) {
  const html = generatePhaseSchedulePdfHtml(data);
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

    // Landscape Letter at 96 DPI (11" x 8.5")
    await page.setViewport({ width: 1056, height: 816 });

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    // Brief wait for rendering
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0.3in',
        right: '0.3in',
        bottom: '0.3in',
        left: '0.3in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating Phase Schedule PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generatePhaseSchedulePdfBuffer };
