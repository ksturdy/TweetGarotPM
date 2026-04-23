/**
 * Generate PDF buffer for Opportunity Search Report using Puppeteer
 */

const { generateOpportunitySearchPdfHtml } = require('./opportunitySearchPdfGenerator');
const { launchBrowser } = require('./launchBrowser');

async function generateOpportunitySearchPdfBuffer(searchData, tenantDomain = 'app.titanpm.com') {
  const html = generateOpportunitySearchPdfHtml(searchData, tenantDomain);

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1056, height: 816 });
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });

    // Give time for any dynamic content to render
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
    });

    await browser.close();
    browser = null;

    return Buffer.from(pdfBuffer);
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // ignore
      }
    }
    throw err;
  }
}

module.exports = { generateOpportunitySearchPdfBuffer };
