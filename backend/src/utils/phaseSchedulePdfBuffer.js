const { launchBrowser } = require('./launchBrowser');
const { generatePhaseSchedulePdfHtml } = require('./phaseSchedulePdfGenerator');

/**
 * Generate a PDF buffer for the Phase Schedule (landscape Letter).
 * @param {Object} data - { items, project, view, mode }
 * @returns {Promise<Buffer>}
 */
async function generatePhaseSchedulePdfBuffer(data) {
  const { logoBase64 } = data;
  const html = generatePhaseSchedulePdfHtml(data);
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

    // Logo sits in the top page margin so it appears in the upper-right
    // corner of every page. Puppeteer's header template doesn't inherit body
    // CSS — sizing must be inline.
    const headerTemplate = logoBase64
      ? `<div style="width: 100%; padding: 0 0.3in; box-sizing: border-box; text-align: right;">
           <img src="${logoBase64}" style="height: 28px; max-width: 140px;" />
         </div>`
      : '<span></span>';

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
        <div style="width: 100%; text-align: center; font-size: 7pt; color: #94a3b8; font-family: system-ui, -apple-system, sans-serif;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>`,
      margin: {
        top: logoBase64 ? '0.5in' : '0.3in',
        right: '0.3in',
        bottom: '0.45in',
        left: '0.3in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating Phase Schedule PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generatePhaseSchedulePdfBuffer };
