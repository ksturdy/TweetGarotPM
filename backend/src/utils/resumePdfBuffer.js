const puppeteer = require('puppeteer');
const { generateResumeHtml } = require('./resumePdfGenerator');

/**
 * Generate PDF buffer from resume data using Puppeteer
 * @param {Object} resume - Resume data
 * @param {Array} projects - Project experience array
 * @param {String} photoBase64 - Base64 encoded photo
 * @returns {Buffer} PDF buffer
 */
async function generateResumePdfBuffer(resume, projects, photoBase64) {
  const html = generateResumeHtml(resume, projects, photoBase64);
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--allow-file-access-from-files',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 }); // Letter size

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    // Wait for images to load (especially the employee photo)
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
    console.error('Error generating resume PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateResumePdfBuffer };
