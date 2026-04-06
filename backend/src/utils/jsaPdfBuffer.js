const { launchBrowser } = require('./launchBrowser');
const { generateJsaPdfHtml } = require('./jsaPdfGenerator');

/**
 * Generate a PDF buffer for a JSA
 * @param {Object} jsa - The JSA object (with hazards merged in)
 * @param {string} logoBase64 - Optional base64 logo data URL
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateJsaPdfBuffer(jsa, logoBase64 = '') {
  const html = generateJsaPdfHtml(jsa, logoBase64);
  let browser = null;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();

    // Landscape letter at 96 DPI
    await page.setViewport({ width: 1056, height: 816 });

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    // Wait a moment for any images to load
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0.35in',
        right: '0.35in',
        bottom: '0.35in',
        left: '0.35in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating JSA PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateJsaPdfBuffer };
