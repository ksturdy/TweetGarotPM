const puppeteer = require('puppeteer');
const { generateFittingOrderPdfHtml } = require('./fittingOrderPdfGenerator');

/**
 * Generate a PDF buffer for a fitting order
 * @param {Object} order - The fitting order object (with items)
 * @param {string} logoBase64 - Optional base64 logo data URL
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateFittingOrderPdfBuffer(order, logoBase64 = '') {
  const html = generateFittingOrderPdfHtml(order, logoBase64);
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
        top: '0.4in',
        right: '0.4in',
        bottom: '0.4in',
        left: '0.4in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating fitting order PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateFittingOrderPdfBuffer };
