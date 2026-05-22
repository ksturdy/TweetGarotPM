const { launchBrowser } = require('./launchBrowser');
const { generateProjectionsReportPdfHtml } = require('./projectionsReportPdfGenerator');

async function generateProjectionsReportPdfBuffer(report, filterContext = {}) {
  const html = generateProjectionsReportPdfHtml(report, filterContext);
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1056, height: 816 });
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
      preferCSSPageSize: false,
    });
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating Projections Report PDF:', error);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generateProjectionsReportPdfBuffer };
