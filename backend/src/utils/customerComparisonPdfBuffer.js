const { launchBrowser } = require('./launchBrowser');
const { generateCustomerComparisonPdfHtml } = require('./customerComparisonPdfGenerator');
const { renderMapScreenshot } = require('./renderMapScreenshot');

/**
 * Generate a PDF buffer for the Customer Comparison Report.
 *
 * The map is rendered server-side in Puppeteer instead of relying on
 * html2canvas, which cannot capture Leaflet SVG/canvas overlays.
 *
 * @param {Array}  projects - The project location data rows
 * @param {Object} options  - { customers, customerColors, filters, mapConfig, includeList }
 * @returns {Promise<Buffer>} - PDF as a buffer
 */
async function generateCustomerComparisonPdfBuffer(projects, options = {}) {
  let browser = null;

  try {
    browser = await launchBrowser();

    // ── Step 1: Render the Leaflet map server-side and screenshot it ──
    let mapImage = null;
    const mc = options.mapConfig;
    if (mc) {
      // Build comparison marker data: color-coded by customer
      const customerColors = options.customerColors || {};
      const comparisonLocations = projects.map(p => ({
        ...p,
        _color: customerColors[p.customer_name] || '#6b7280',
      }));

      mapImage = await renderMapScreenshot(browser, {
        center: mc.center || [39.8283, -98.5795],
        zoom: mc.zoom || 4,
        tileUrl: mc.tileUrl,
        standardLayers: ['projects'], // Always show project markers for comparison
        locations: comparisonLocations,
        stateRevenueData: {},
        customPins: mc.customPins || [],
        customerColors, // Pass for color-coded markers
      });
    }

    // ── Step 2: Generate the PDF HTML with the server-rendered map image ──
    const html = generateCustomerComparisonPdfHtml(projects, {
      customers: options.customers,
      customerColors: options.customerColors,
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
    console.error('Error generating Customer Comparison PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { generateCustomerComparisonPdfBuffer };
