const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

// Search for businesses using Foursquare Places API
router.get('/search', authenticate, async (req, res) => {
  try {
    const { query, near, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const apiKey = process.env.FOURSQUARE_API_KEY;
    if (!apiKey) {
      console.error('FOURSQUARE_API_KEY not configured');
      return res.status(500).json({ error: 'Foursquare API key not configured' });
    }

    // Build Foursquare API URL
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      fields: 'name,location,tel,website,fsq_id',
    });

    // Add location bias if provided (e.g., "Dallas, TX")
    if (near) {
      params.append('near', near);
    }

    const response = await axios.get(
      `https://api.foursquare.com/v3/places/search?${params.toString()}`,
      {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      }
    );

    // Transform to simpler format
    const places = (response.data.results || []).map(place => ({
      id: place.fsq_id,
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
    console.error('Places search error:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(500).json({ error: 'Invalid Foursquare API key' });
    }

    res.status(500).json({ error: 'Failed to search places' });
  }
});

module.exports = router;
