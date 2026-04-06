const { launchBrowser } = require('./launchBrowser');
const { generateBacklogReportPdfHtml } = require('./backlogReportPdfGenerator');

/**
 * Generate a PDF buffer for the Backlog Fit Analysis Report (landscape Letter).
 * @param {Object} reportData - output of buildBacklogFitReport()
 * @param {Array} recommendations - output of generateStrategyRecommendations()
 * @param {string} generatedBy - user name for cover page
 * @returns {Promise<Buffer>}
 */
async function generateBacklogReportPdfBuffer(reportData, recommendations, generatedBy) {
  const html = generateBacklogReportPdfHtml(reportData, recommendations, generatedBy);
  let browser = null;

  try {
    browser = await launchBrowser();

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
        top: '0.4in',
        right: '0.4in',
        bottom: '0.4in',
        left: '0.4in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating Backlog Fit Report PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateBacklogReportPdfBuffer };
