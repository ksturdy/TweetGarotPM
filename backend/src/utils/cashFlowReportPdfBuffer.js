const { launchBrowser } = require('./launchBrowser');
const { generateCashFlowReportPdfHtml } = require('./cashFlowReportPdfGenerator');

/**
 * Generate a PDF buffer for the Cash Flow Report
 * @param {Array} projects - The cash flow project data rows
 * @param {Object} filters - Active filter labels for display
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateCashFlowReportPdfBuffer(projects, filters = {}) {
  const html = generateCashFlowReportPdfHtml(projects, filters);
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
    console.error('Error generating Cash Flow Report PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateCashFlowReportPdfBuffer };
