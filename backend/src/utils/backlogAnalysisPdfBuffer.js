const { launchBrowser } = require('./launchBrowser');
const { generateBacklogAnalysisPdfHtml } = require('./backlogAnalysisPdfGenerator');

/**
 * Generate a PDF buffer for the Backlog Analysis Report (portrait Letter).
 */
async function generateBacklogAnalysisPdfBuffer(data, generatedBy) {
  const html = generateBacklogAnalysisPdfHtml(data, generatedBy);
  let browser = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 850 });
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error('Error generating Backlog Analysis PDF:', err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generateBacklogAnalysisPdfBuffer };
