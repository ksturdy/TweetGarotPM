const { launchBrowser } = require('./launchBrowser');
const { generateProposalPdfHtml } = require('./proposalPdfGenerator');

async function generateProposalPdfBuffer(proposal, logoBase64, caseStudyPages = [], sellSheetPages = [], orgChartData = []) {
  const html = generateProposalPdfHtml(proposal, logoBase64, caseStudyPages, sellSheetPages, orgChartData);
  let browser = null;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating proposal PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateProposalPdfBuffer };
