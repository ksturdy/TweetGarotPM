const puppeteer = require('puppeteer');
const { generateExecutiveReportPdfHtml } = require('./executiveReportPdfGenerator');

/**
 * Generate a PDF buffer for the Executive Report
 * @param {Object} reportData - The report data (same shape as GET /api/executive-report response)
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateExecutiveReportPdfBuffer(reportData) {
  const html = generateExecutiveReportPdfHtml(reportData);
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

    // Set viewport for consistent rendering (Letter size at 96 DPI)
    await page.setViewport({ width: 816, height: 1056 });

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    // Brief wait for rendering
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

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
    console.error('Error generating Executive Report PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateExecutiveReportPdfBuffer };
