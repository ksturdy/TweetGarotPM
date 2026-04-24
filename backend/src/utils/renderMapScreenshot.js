/**
 * Render a Leaflet map server-side using Puppeteer and return a base64 PNG data URL.
 *
 * This replaces the broken html2canvas approach — html2canvas cannot capture
 * Leaflet's SVG overlays, canvas layers, or marker cluster DOM elements.
 * Puppeteer renders a real browser page, so everything renders correctly.
 */

const https = require('https');

const US_GEOJSON_URL = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';
let cachedGeoJSON = null;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function getUSGeoJSON() {
  if (cachedGeoJSON) return cachedGeoJSON;
  cachedGeoJSON = await fetchJSON(US_GEOJSON_URL);
  return cachedGeoJSON;
}

/**
 * Build an HTML page that renders a Leaflet map with all the requested layers.
 */
function buildMapHtml(opts) {
  const {
    center = [39.8283, -98.5795],
    zoom = 4,
    tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    width = 1000,
    height = 550,
    locations = [],
    stateRevenueData = {},
    standardLayers = [],
    customPins = [],
    geoJSON = null,
  } = opts;

  const showProjects = standardLayers.includes('projects');
  const showRevenue = standardLayers.includes('revenue');

  // Safely embed JSON — escape </script> sequences
  const safeJSON = (obj) => JSON.stringify(obj).replace(/<\//g, '<\\/');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <style>
    * { margin: 0; padding: 0; }
    body { overflow: hidden; }
    #map { width: ${width}px; height: ${height}px; background: #ffffff; position: relative; }
    /* Hide Leaflet attribution & zoom for clean PDF look */
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
  <script>
    (function() {
      window.__mapReady = false;

      var map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
      }).setView(${safeJSON(center)}, ${zoom});

      // Expose map globally so post-render mask can use latLngToContainerPoint
      window.__map = map;

      var tileLayer = L.tileLayer(${safeJSON(tileUrl)}, {
        maxZoom: 18,
      });
      tileLayer.addTo(map);

${showRevenue && geoJSON ? `
      // ── Revenue choropleth layer ──
      (function() {
        var stateData = ${safeJSON(stateRevenueData)};
        var geo = ${safeJSON(geoJSON)};
        var maxRevenue = Math.max.apply(null,
          Object.keys(stateData).map(function(k) { return stateData[k].revenue; }).concat([1])
        );

        var nameToAbbr = {
          'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
          'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
          'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS',
          'Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA',
          'Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT',
          'Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
          'New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
          'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
          'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
          'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
          'District of Columbia':'DC'
        };

        function getColor(revenue) {
          if (maxRevenue === 0 || revenue === 0) return '#f1f5f9';
          var ratio = revenue / maxRevenue;
          if (ratio > 0.75) return '#166534';
          if (ratio > 0.5) return '#16a34a';
          if (ratio > 0.25) return '#4ade80';
          if (ratio > 0.05) return '#bbf7d0';
          return '#dcfce7';
        }

        function fmtCurrency(n) {
          if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
          if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
          return '$' + n.toLocaleString();
        }

        L.geoJSON(geo, {
          style: function(feature) {
            var name = feature.properties.name || '';
            var abbr = nameToAbbr[name] || '';
            var d = stateData[abbr];
            var rev = d ? d.revenue : 0;
            return {
              fillColor: getColor(rev),
              weight: 1,
              opacity: 1,
              color: '#94a3b8',
              fillOpacity: rev > 0 ? 0.7 : 0.2,
            };
          },
          onEachFeature: function(feature, layer) {
            var name = feature.properties.name || '';
            var abbr = nameToAbbr[name] || '';
            var d = stateData[abbr];
            if (d && d.revenue > 0) {
              var bounds = layer.getBounds ? layer.getBounds() : null;
              if (bounds) {
                var ctr = bounds.getCenter();
                L.marker(ctr, {
                  icon: L.divIcon({
                    className: '',
                    html: '<div style="text-align:center;white-space:nowrap;pointer-events:none;">' +
                      '<div style="font-size:11px;font-weight:700;color:#1e293b;text-shadow:0 0 3px white,0 0 3px white">' + d.count + ' proj<\\/div>' +
                      '<div style="font-size:10px;font-weight:600;color:#166534;text-shadow:0 0 3px white,0 0 3px white">' + fmtCurrency(d.revenue) + '<\\/div>' +
                      '<\\/div>',
                    iconSize: [70, 30],
                    iconAnchor: [35, 15],
                  }),
                  interactive: false,
                }).addTo(map);
              }
            }
          },
        }).addTo(map);
      })();
` : ''}

${showProjects && locations.length > 0 ? `
      // ── Project marker clusters ──
      (function() {
        var locs = ${safeJSON(locations)};
        var statusColors = {
          'Open':'#10b981','active':'#10b981',
          'Soft-Closed':'#f59e0b','on_hold':'#f59e0b',
          'Hard-Closed':'#6b7280','completed':'#6b7280',
          'cancelled':'#ef4444'
        };

        var cluster = L.markerClusterGroup({
          maxClusterRadius: 40,
          spiderfyOnMaxZoom: false,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: false,
          animate: false,
        });

        locs.forEach(function(loc) {
          if (!loc.latitude || !loc.longitude) return;
          var color = loc._color || statusColors[loc.status] || '#6b7280';
          cluster.addLayer(L.marker([loc.latitude, loc.longitude], {
            icon: L.divIcon({
              className: '',
              html: '<div style="width:12px;height:12px;background:' + color +
                ';border:2px solid white;border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,0.15);"><\\/div>',
              iconSize: [12, 12],
              iconAnchor: [6, 6],
            }),
          }));
        });

        map.addLayer(cluster);
      })();
` : ''}

${customPins.map((cp, i) => `
      // ── Custom layer: ${(cp.name || '').replace(/['"\\]/g, '')} ──
      (function() {
        var pins = ${safeJSON(cp.pins)};
        var color = ${safeJSON(cp.color)};

        var cluster = L.markerClusterGroup({
          maxClusterRadius: 35,
          spiderfyOnMaxZoom: false,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: false,
          animate: false,
          iconCreateFunction: function(c) {
            var n = c.getChildCount();
            return L.divIcon({
              className: '',
              html: '<div style="width:24px;height:24px;background:' + color +
                ';border:2px solid white;border-radius:50%;color:white;font-size:10px;font-weight:700;' +
                'display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.3);">' + n + '<\\/div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });
          },
        });

        pins.forEach(function(pin) {
          if (!pin.latitude || !pin.longitude) return;
          cluster.addLayer(L.marker([pin.latitude, pin.longitude], {
            icon: L.divIcon({
              className: '',
              html: '<div style="width:10px;height:10px;background:' + color +
                ';border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.25);"><\\/div>',
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            }),
          }));
        });

        map.addLayer(cluster);
      })();
`).join('\n')}

      // Track when tiles finish loading
      tileLayer.on('load', function() {
        setTimeout(function() { window.__mapReady = true; }, 600);
      });

      // Fallback: if tiles never fire load, set ready after timeout
      setTimeout(function() {
        if (!window.__mapReady) window.__mapReady = true;
      }, 12000);
    })();
  <\/script>
</body>
</html>`;
}

/**
 * After the map renders, draw a white canvas mask over everything outside the
 * US state boundaries.  Uses the proven "fill white + destination-out to cut
 * state shapes + re-draw state borders" approach from the old applyUSMaskToCanvas.
 */
async function drawCanvasMask(page, geoJSON) {
  if (!geoJSON) return;

  await page.evaluate((geoStr) => {
    var geo = JSON.parse(geoStr);
    var mapEl = document.getElementById('map');
    var lMap = window.__map;
    if (!lMap) return;

    var scale = window.devicePixelRatio || 1;
    var w = mapEl.offsetWidth;
    var h = mapEl.offsetHeight;

    var canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:' + w + 'px;height:' + h + 'px;z-index:999;pointer-events:none;';
    mapEl.appendChild(canvas);

    var ctx = canvas.getContext('2d');

    // 1. Fill entire canvas white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Cut out US state shapes (makes them transparent → map shows through)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';

    geo.features.forEach(function(feature) {
      var type = feature.geometry.type;
      var coords = feature.geometry.coordinates;
      var rings = type === 'MultiPolygon'
        ? coords.map(function(p) { return p[0]; })
        : [coords[0]];

      rings.forEach(function(ring) {
        ctx.beginPath();
        ring.forEach(function(pt, i) {
          var px = lMap.latLngToContainerPoint([pt[1], pt[0]]);
          var x = px.x * scale;
          var y = px.y * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      });
    });

    // 3. Draw state borders on top
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5 * scale;

    geo.features.forEach(function(feature) {
      var type = feature.geometry.type;
      var coords = feature.geometry.coordinates;
      var rings = type === 'MultiPolygon'
        ? coords.map(function(p) { return p[0]; })
        : [coords[0]];

      rings.forEach(function(ring) {
        ctx.beginPath();
        ring.forEach(function(pt, i) {
          var px = lMap.latLngToContainerPoint([pt[1], pt[0]]);
          var x = px.x * scale;
          var y = px.y * scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
      });
    });
  }, JSON.stringify(geoJSON));
}

/**
 * Render a Leaflet map in Puppeteer and return a base64 PNG data URL.
 *
 * @param {import('puppeteer').Browser} browser - Already-launched Puppeteer browser
 * @param {Object} opts
 * @param {number[]} opts.center   - [lat, lng]
 * @param {number}   opts.zoom
 * @param {string}   opts.tileUrl
 * @param {string[]} opts.standardLayers - e.g. ['projects','revenue']
 * @param {Array}    opts.locations      - MapProject rows (for project markers)
 * @param {Object}   opts.stateRevenueData
 * @param {Array}    opts.customPins     - [{pins, color, name}]
 * @returns {Promise<string>} data:image/png;base64,… URL
 */
async function renderMapScreenshot(browser, opts = {}) {
  const width = opts.width || 1000;
  const height = opts.height || 550;

  // Fetch US state GeoJSON (cached after first call)
  let geoJSON = null;
  try {
    geoJSON = await getUSGeoJSON();
  } catch (err) {
    console.warn('Failed to fetch US GeoJSON for map render:', err.message);
  }

  const html = buildMapHtml({ ...opts, geoJSON, width, height });

  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for our JS flag that fires after tiles + layers finish
    await page.waitForFunction('window.__mapReady === true', { timeout: 15000 });

    // Draw the white mask outside US on a canvas overlay (above all Leaflet layers)
    await drawCanvasMask(page, geoJSON);

    // Brief extra pause for the canvas to paint
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));

    const screenshot = await page.screenshot({
      encoding: 'base64',
      type: 'png',
      clip: { x: 0, y: 0, width, height },
    });

    return `data:image/png;base64,${screenshot}`;
  } finally {
    await page.close();
  }
}

module.exports = { renderMapScreenshot };
