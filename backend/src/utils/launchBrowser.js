/**
 * Shared Puppeteer browser launcher.
 * In production (Render), uses @sparticuz/chromium which bundles its own binary.
 * Locally, uses full puppeteer which downloads its own Chrome.
 */
async function launchBrowser() {
  if (process.env.NODE_ENV === 'production') {
    const chromium = require('@sparticuz/chromium');
    const puppeteerCore = require('puppeteer-core');
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    const puppeteer = require('puppeteer');
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
}

module.exports = { launchBrowser };
