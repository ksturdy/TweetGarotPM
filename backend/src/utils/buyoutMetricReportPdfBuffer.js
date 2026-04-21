const { launchBrowser } = require('./launchBrowser');
const { generateBuyoutMetricReportPdfHtml } = require('./buyoutMetricReportPdfGenerator');

/**
 * Generate a PDF buffer for the Buyout Metric Report
 * @param {Array} projects - The buyout metric project data rows
 * @param {Object} filters - Active filter labels for display
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateBuyoutMetricReportPdfBuffer(projects, filters = {}) {
  const html = generateBuyoutMetricReportPdfHtml(projects, filters);
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
    console.error('Error generating Buyout Metric Report PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateBuyoutMetricReportPdfBuffer };
