const { launchBrowser } = require('./launchBrowser');
const { generateProjectedRevenuePdfHtml } = require('./projectedRevenuePdfGenerator');

/**
 * Generate a PDF buffer for the Projected Revenue / Revenue Forecast report.
 */
async function generateProjectedRevenuePdfBuffer(reportData, filters = {}, scheduleName = null) {
  const html = generateProjectedRevenuePdfHtml(reportData, filters, scheduleName);
  let browser = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1056, height: 816 });
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error('Error generating Projected Revenue PDF:', err);
    throw err;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = { generateProjectedRevenuePdfBuffer };
