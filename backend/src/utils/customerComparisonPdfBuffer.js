const { launchBrowser } = require('./launchBrowser');
const { generateCustomerComparisonPdfHtml } = require('./customerComparisonPdfGenerator');

/**
 * Generate a PDF buffer for the Customer Comparison Report
 * @param {Array}  projects - The project location data rows
 * @param {Object} options  - { customers, customerColors, filters, mapImage, includeList }
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateCustomerComparisonPdfBuffer(projects, options = {}) {
  const html = generateCustomerComparisonPdfHtml(projects, options);
  let browser = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1056, height: 816 });

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
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
    console.error('Error generating Customer Comparison PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateCustomerComparisonPdfBuffer };
