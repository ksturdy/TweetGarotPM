const { launchBrowser } = require('./launchBrowser');
const { generateProjectLocationsPdfHtml } = require('./projectLocationsPdfGenerator');
const { renderMapScreenshot } = require('./renderMapScreenshot');

/**
 * Generate a PDF buffer for the Project Locations Report.
 *
 * The map is rendered server-side in Puppeteer (real browser) instead of relying
 * on html2canvas on the frontend, which cannot capture Leaflet SVG/canvas overlays.
 *
 * @param {Array}  projects - The project location data rows
 * @param {Object} options
 * @param {Object}  options.filters        - Active filter labels for display
 * @param {Object}  options.mapConfig      - Map viewport & layer settings from frontend
 * @param {boolean} options.includeList    - Whether to append the project detail table
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateProjectLocationsPdfBuffer(projects, options = {}) {
  let browser = null;

  try {
    browser = await launchBrowser();

    // ── Step 1: Render the Leaflet map server-side and screenshot it ──
    let mapImage = null;
    const mc = options.mapConfig;
    if (mc) {
      // Compute state revenue data from filtered project rows
      const stateRevenueData = {};
      projects.forEach(p => {
        const st = (p.ship_state || '').toUpperCase().trim();
        if (!st) return;
        if (!stateRevenueData[st]) stateRevenueData[st] = { revenue: 0, count: 0 };
        stateRevenueData[st].revenue += Number(p.contract_value) || 0;
        stateRevenueData[st].count += 1;
      });

      mapImage = await renderMapScreenshot(browser, {
        center: mc.center || [39.8283, -98.5795],
        zoom: mc.zoom || 4,
        tileUrl: mc.tileUrl,
        standardLayers: mc.standardLayers || [],
        locations: projects,
        stateRevenueData,
        customPins: mc.customPins || [],
      });
    }

    // ── Step 2: Generate the PDF HTML with the server-rendered map image ──
    const html = generateProjectLocationsPdfHtml(projects, {
      filters: options.filters,
      mapImage,
      includeList: options.includeList,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1056, height: 816 });

    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
      timeout: 30000,
    });

    // Brief pause for image rendering
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: {
        top: '0.4in',
        right: '0.4in',
        bottom: '0.4in',
        left: '0.4in',
      },
      preferCSSPageSize: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating Project Locations PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateProjectLocationsPdfBuffer };
