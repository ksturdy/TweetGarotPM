const axios = require('axios');

const GEOCODIO_URL = 'https://api.geocod.io/v1.7/geocode';
const GEOCODIO_BATCH_URL = 'https://api.geocod.io/v1.7/geocode';
const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/address';
const RATE_LIMIT_MS = 350;

let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * State bounding boxes [south, north, west, east] for validation.
 */
const STATE_BOUNDS = {
  AL: [30.1, 35.1, -88.8, -84.8], AK: [51.0, 71.5, -180.0, -129.0],
  AZ: [31.3, 37.1, -115.0, -109.0], AR: [33.0, 36.6, -94.7, -89.6],
  CA: [32.5, 42.1, -124.5, -114.1], CO: [36.9, 41.1, -109.1, -102.0],
  CT: [40.9, 42.1, -73.8, -71.7], DE: [38.4, 39.9, -75.8, -75.0],
  FL: [24.4, 31.1, -87.7, -79.9], GA: [30.3, 35.1, -85.7, -80.7],
  HI: [18.9, 22.3, -160.3, -154.7], ID: [41.9, 49.1, -117.3, -111.0],
  IL: [36.9, 42.6, -91.6, -87.0], IN: [37.7, 41.8, -88.1, -84.7],
  IA: [40.3, 43.6, -96.7, -90.1], KS: [36.9, 40.1, -102.1, -94.5],
  KY: [36.4, 39.2, -89.6, -81.9], LA: [28.9, 33.1, -94.1, -88.7],
  ME: [43.0, 47.5, -71.1, -66.9], MD: [37.9, 39.8, -79.5, -75.0],
  MA: [41.2, 42.9, -73.6, -69.9], MI: [41.6, 48.3, -90.5, -82.1],
  MN: [43.4, 49.4, -97.3, -89.4], MS: [30.1, 35.0, -91.7, -88.0],
  MO: [35.9, 40.7, -95.8, -89.0], MT: [44.3, 49.1, -116.1, -104.0],
  NE: [39.9, 43.1, -104.1, -95.3], NV: [34.9, 42.1, -120.1, -114.0],
  NH: [42.6, 45.4, -72.6, -70.6], NJ: [38.8, 41.4, -75.6, -73.9],
  NM: [31.3, 37.1, -109.1, -103.0], NY: [40.4, 45.1, -79.8, -71.8],
  NC: [33.8, 36.6, -84.4, -75.4], ND: [45.9, 49.1, -104.1, -96.5],
  OH: [38.3, 42.0, -84.9, -80.5], OK: [33.6, 37.1, -103.1, -94.4],
  OR: [41.9, 46.3, -124.7, -116.4], PA: [39.7, 42.3, -80.6, -74.7],
  RI: [41.1, 42.1, -71.9, -71.1], SC: [32.0, 35.3, -83.4, -78.5],
  SD: [42.4, 46.0, -104.1, -96.4], TN: [34.9, 36.7, -90.4, -81.6],
  TX: [25.8, 36.6, -106.7, -93.5], UT: [36.9, 42.1, -114.1, -109.0],
  VT: [42.7, 45.1, -73.5, -71.4], VA: [36.5, 39.5, -83.7, -75.2],
  WA: [45.5, 49.1, -124.9, -116.9], WV: [37.2, 40.7, -82.7, -77.7],
  WI: [42.4, 47.1, -92.9, -86.7], WY: [40.9, 45.1, -111.1, -104.0],
  DC: [38.8, 39.0, -77.2, -76.9],
};

const STATE_CENTROIDS = {
  AL: [32.806671, -86.791130], AK: [61.370716, -152.404419],
  AZ: [33.729759, -111.431221], AR: [34.969704, -92.373123],
  CA: [36.116203, -119.681564], CO: [39.059811, -105.311104],
  CT: [41.597782, -72.755371], DE: [39.318523, -75.507141],
  FL: [27.766279, -81.686783], GA: [33.040619, -83.643074],
  HI: [21.094318, -157.498337], ID: [44.240459, -114.478828],
  IL: [40.349457, -88.986137], IN: [39.849426, -86.258278],
  IA: [42.011539, -93.210526], KS: [38.526600, -96.726486],
  KY: [37.668140, -84.670067], LA: [31.169546, -91.867805],
  ME: [44.693947, -69.381927], MD: [39.063946, -76.802101],
  MA: [42.230171, -71.530106], MI: [43.326618, -84.536095],
  MN: [45.694454, -93.900192], MS: [32.741646, -89.678696],
  MO: [38.456085, -92.288368], MT: [46.921925, -110.454353],
  NE: [41.125370, -98.268082], NV: [38.313515, -117.055374],
  NH: [43.452492, -71.563896], NJ: [40.298904, -74.521011],
  NM: [34.840515, -106.248482], NY: [42.165726, -74.948051],
  NC: [35.630066, -79.806419], ND: [47.528912, -99.784012],
  OH: [40.388783, -82.764915], OK: [35.565342, -96.928917],
  OR: [44.572021, -122.070938], PA: [40.590752, -77.209755],
  RI: [41.680893, -71.511780], SC: [33.856892, -80.945007],
  SD: [44.299782, -99.438828], TN: [35.747845, -86.692345],
  TX: [31.054487, -97.563461], UT: [40.150032, -111.862434],
  VT: [44.045876, -72.710686], VA: [37.769337, -78.169968],
  WA: [47.400902, -121.490494], WV: [38.491226, -80.954453],
  WI: [44.268543, -89.616508], WY: [42.755966, -107.302490],
  DC: [38.897438, -77.026817],
};

const STATE_NAME_TO_ABBR = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

function normalizeState(state) {
  if (!state) return null;
  const trimmed = state.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_ABBR[trimmed.toLowerCase()] || null;
}

function isInState(lat, lng, stateAbbr) {
  const bounds = STATE_BOUNDS[stateAbbr];
  if (!bounds) return true;
  const [south, north, west, east] = bounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

function getGeocodioKey() {
  return process.env.GEOCODIO_API_KEY || null;
}

// ─── Geocodio (primary — accurate, $1/1000 lookups) ─────────────────────────

/**
 * Geocode a single address via Geocodio.
 */
async function geocodeGeocodio(addressString) {
  const apiKey = getGeocodioKey();
  if (!apiKey) return null;

  await rateLimit();
  try {
    const response = await axios.get(GEOCODIO_URL, {
      params: {
        q: addressString,
        api_key: apiKey,
        limit: 1,
      },
      timeout: 10000,
    });
    const results = response.data?.results;
    if (results && results.length > 0 && results[0].accuracy >= 0.5) {
      const { lat, lng } = results[0].location;
      return { lat, lng, accuracy: results[0].accuracy, source: 'geocodio' };
    }
  } catch (err) {
    console.error('[Geocoder] Geocodio error:', err.message);
  }
  return null;
}

/**
 * Batch geocode up to 10,000 addresses via Geocodio.
 * Input: array of address strings.
 * Returns: array of { lat, lng, accuracy } or null for each input.
 */
async function batchGeocodeGeocodio(addresses) {
  const apiKey = getGeocodioKey();
  if (!apiKey) return addresses.map(() => null);

  const BATCH_SIZE = 500; // Geocodio recommends max ~10,000 but 500 keeps responses fast
  const results = [];

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    try {
      const response = await axios.post(
        `${GEOCODIO_BATCH_URL}?api_key=${apiKey}`,
        batch,
        { timeout: 60000 }
      );
      const batchResults = response.data?.results || [];
      for (const item of batchResults) {
        const r = item?.response?.results;
        if (r && r.length > 0 && r[0].accuracy >= 0.5) {
          results.push({ lat: r[0].location.lat, lng: r[0].location.lng, accuracy: r[0].accuracy, source: 'geocodio' });
        } else {
          results.push(null);
        }
      }
    } catch (err) {
      console.error(`[Geocoder] Geocodio batch error (offset ${i}):`, err.message);
      // Fill with nulls for this failed batch
      for (let j = 0; j < batch.length; j++) results.push(null);
    }
  }

  return results;
}

// ─── Census Bureau (free fallback) ──────────────────────────────────────────

async function geocodeCensus(street, city, state, zip) {
  await rateLimit();
  try {
    const response = await axios.get(CENSUS_URL, {
      params: { street, city, state, zip, benchmark: 'Public_AR_Current', format: 'json' },
      timeout: 15000,
    });
    const matches = response.data?.result?.addressMatches;
    if (matches && matches.length > 0) {
      const { x: lng, y: lat } = matches[0].coordinates;
      return { lat, lng, source: 'census' };
    }
  } catch (err) {
    // Fall through
  }
  return null;
}

// ─── Main geocode function ──────────────────────────────────────────────────

/**
 * Build full address string from project fields.
 */
function buildAddressString(project) {
  if (project.ship_city && project.ship_state) {
    const parts = [
      project.ship_address,
      project.ship_city,
      project.ship_state,
      project.ship_zip,
    ].filter(Boolean);
    return parts.join(', ');
  }
  return project.address || null;
}

/**
 * Geocode a single project. Strategy:
 * 1. Geocodio (if API key configured) — most accurate
 * 2. Census Bureau structured — free fallback
 * 3. State centroid — last resort (at least correct state)
 * All results validated against expected state bounding box.
 */
async function geocodeAddress(project) {
  const stateAbbr = normalizeState(project.ship_state);
  const addressStr = buildAddressString(project);

  // 1. Geocodio (primary)
  if (addressStr) {
    const result = await geocodeGeocodio(addressStr);
    if (result && (!stateAbbr || isInState(result.lat, result.lng, stateAbbr))) {
      return result;
    }
  }

  // 2. Census Bureau structured (free fallback)
  if (project.ship_city && project.ship_state && project.ship_address) {
    const result = await geocodeCensus(
      project.ship_address,
      project.ship_city,
      project.ship_state,
      project.ship_zip || ''
    );
    if (result && (!stateAbbr || isInState(result.lat, result.lng, stateAbbr))) {
      return result;
    }
  }

  // 3. State centroid (last resort — at least in the right state)
  if (stateAbbr && STATE_CENTROIDS[stateAbbr]) {
    const [lat, lng] = STATE_CENTROIDS[stateAbbr];
    return { lat, lng, source: 'centroid' };
  }

  return null;
}

module.exports = { geocodeAddress, buildAddressString, batchGeocodeGeocodio, normalizeState, isInState, STATE_CENTROIDS };
