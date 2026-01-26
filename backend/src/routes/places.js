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

    // Build Foursquare Places API URL (new endpoint as of 2025)
    const params = new URLSearchParams({
      query,
      limit: String(limit),
    });

    // Add location bias if provided (e.g., "Dallas, TX")
    if (near) {
      params.append('near', near);
    }

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
