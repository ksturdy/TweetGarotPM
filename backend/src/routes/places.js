const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

// US State abbreviations
const STATE_ABBREVS = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

// Multi-word cities to detect
const MULTI_WORD_CITIES = ['Green Bay', 'New York', 'Los Angeles', 'San Francisco', 'San Diego', 'Las Vegas', 'Salt Lake City', 'Kansas City', 'Oklahoma City', 'New Orleans', 'San Antonio', 'Fort Worth', 'El Paso', 'St Louis', 'St. Louis'];

// Extract location from query (e.g., "Ferguson Plumbing Phoenix AZ" -> { query: "Ferguson Plumbing", near: "Phoenix, AZ" })
function parseQueryForLocation(rawQuery, defaultNear) {
  let query = rawQuery.trim();
  let near = defaultNear || 'USA';

  // Check for multi-word cities first (case insensitive)
  for (const city of MULTI_WORD_CITIES) {
    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
    if (cityRegex.test(query)) {
      // Extract city and check for state after it
      const match = query.match(new RegExp(`(.*)\\b(${city})\\s*,?\\s*(${STATE_ABBREVS.join('|')})?\\b(.*)`, 'i'));
      if (match) {
        const businessName = (match[1] + ' ' + match[4]).trim().replace(/\s+/g, ' ');
        const foundCity = match[2];
        const state = match[3] || '';
        near = state ? `${foundCity}, ${state}` : foundCity;
        query = businessName || query;
        return { query, near };
      }
    }
  }

  // Check for "City, STATE" or "City STATE" pattern at the end
  const cityStateRegex = new RegExp(`^(.+?)\\s+([A-Za-z][A-Za-z\\s]*?)\\s*,?\\s*(${STATE_ABBREVS.join('|')})\\s*$`, 'i');
  const cityStateMatch = query.match(cityStateRegex);
  if (cityStateMatch) {
    query = cityStateMatch[1].trim();
    const city = cityStateMatch[2].trim();
    const state = cityStateMatch[3].toUpperCase();
    near = `${city}, ${state}`;
    return { query, near };
  }

  // Check for just state abbreviation at the end
  const stateOnlyRegex = new RegExp(`^(.+?)\\s+(${STATE_ABBREVS.join('|')})\\s*$`, 'i');
  const stateOnlyMatch = query.match(stateOnlyRegex);
  if (stateOnlyMatch) {
    // Check if the word before the state looks like a city (capitalized, not common business words)
    const parts = stateOnlyMatch[1].trim().split(/\s+/);
    if (parts.length >= 2) {
      const potentialCity = parts[parts.length - 1];
      const businessWords = ['supply', 'plumbing', 'hvac', 'heating', 'cooling', 'electric', 'mechanical', 'inc', 'llc', 'corp'];
      if (!businessWords.includes(potentialCity.toLowerCase())) {
        query = parts.slice(0, -1).join(' ');
        near = `${potentialCity}, ${stateOnlyMatch[2].toUpperCase()}`;
        return { query, near };
      }
    }
  }

  return { query, near };
}

// Search for businesses using Foursquare Places API
router.get('/search', authenticate, async (req, res) => {
  try {
    const { query: rawQuery, near: defaultNear, limit = 10 } = req.query;

    if (!rawQuery) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const apiKey = process.env.FOURSQUARE_API_KEY;
    if (!apiKey) {
      console.error('FOURSQUARE_API_KEY not configured');
      return res.status(500).json({ error: 'Foursquare API key not configured' });
    }

    // Parse query for embedded location info
    const { query, near } = parseQueryForLocation(rawQuery, defaultNear);

    // Build Foursquare Places API URL (new endpoint as of 2025)
    const params = new URLSearchParams({
      query,
      limit: String(limit),
    });

    // Add location
    params.append('near', near);

    const response = await axios.get(
      `https://places-api.foursquare.com/places/search?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'X-Places-Api-Version': '2025-06-17',
        },
      }
    );

    // Transform to simpler format
    const places = (response.data.results || []).map(place => ({
      id: place.fsq_place_id,
      name: place.name,
      address: place.location?.address || '',
      city: place.location?.locality || '',
      state: place.location?.region || '',
      zip_code: place.location?.postcode || '',
      country: place.location?.country || 'USA',
      phone: place.tel || '',
      website: place.website || '',
      formatted_address: place.location?.formatted_address || '',
    }));

    res.json({ places });
  } catch (error) {
    console.error('Places search error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 401) {
      return res.status(500).json({ error: 'Invalid Foursquare API key' });
    }
    if (error.response?.status === 403) {
      return res.status(500).json({ error: 'Foursquare API key lacks permissions' });
    }

    res.status(500).json({
      error: 'Failed to search places',
      details: error.response?.data?.message || error.message
    });
  }
});

module.exports = router;
