const { launchBrowser } = require('./launchBrowser');
const { generateResumeHtml } = require('./resumePdfGenerator');

/**
 * Generate PDF buffer from resume data using Puppeteer
 * @param {Object} resume - Resume data
 * @param {Array} projects - Project experience array
 * @param {String} photoBase64 - Base64 encoded photo
 * @returns {Buffer} PDF buffer
 */
async function generateResumePdfBuffer(resume, projects, photoBase64, template = null) {
  const html = generateResumeHtml(resume, projects, photoBase64, template);
  let browser = null;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 }); // Letter size

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for all images to finish decoding before capturing the PDF.
    // img.decode() resolves only when the image is decoded and ready to paint,
    // which is more reliable than a fixed timeout for large base64 data URLs.
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        imgs.map(img =>
          img.decode ? img.decode().catch(() => {}) : Promise.resolve()
        )
      );
    });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: false,
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
      preferCSSPageSize: false,
      // Hard-cap at the first page - resume template is single-page by design.
      pageRanges: '1',
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating resume PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateResumePdfBuffer };
