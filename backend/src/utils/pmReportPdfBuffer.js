const { launchBrowser } = require('./launchBrowser');
const { generatePMReportPdfHtml } = require('./pmReportPdfGenerator');

/**
 * Generate a PDF buffer for the Project Manager Report.
 * @param {Object} data - Output of buildPMReportData()
 * @param {string|null} scheduleName - Optional scheduled report name for header
 * @returns {Promise<Buffer>}
 */
async function generatePMReportPdfBuffer(data, scheduleName = null) {
  const html = generatePMReportPdfHtml(data, scheduleName);
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
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
      preferCSSPageSize: false,
    });
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating PM Report PDF:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generatePMReportPdfBuffer };
