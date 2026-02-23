const express = require('express');
const router = express.Router();
const UserFavorite = require('../models/UserFavorite');
const { authenticate } = require('../middleware/auth');

/**
 * @route   POST /api/favorites/toggle
 * @desc    Toggle favorite status for an entity
 * @access  Private
 */
router.post('/toggle', authenticate, async (req, res) => {
  try {
    const { entityType, entityId } = req.body;
    const userId = req.user.id;

    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }

    // Validate entity type
    const validTypes = ['project', 'customer', 'estimate', 'proposal', 'case_study', 'contract_review'];
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({ error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}` });
    }

    const result = await UserFavorite.toggle(userId, entityType, entityId);

    res.json({
      success: true,
      isFavorited: result.isFavorited,
      message: result.isFavorited ? 'Added to favorites' : 'Removed from favorites'
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

/**
 * @route   GET /api/favorites/:entityType
 * @desc    Get all favorited entities of a specific type for the current user
 * @access  Private
 */
router.get('/:entityType', authenticate, async (req, res) => {
  try {
    const { entityType } = req.params;
    const userId = req.user.id;

    const favorites = await UserFavorite.getUserFavorites(userId, entityType);

    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

/**
 * @route   GET /api/favorites
 * @desc    Get all favorites for the current user (all types)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const favorites = await UserFavorite.getUserFavorites(userId);

    res.json(favorites);
  } catch (error) {
    console.error('Error fetching all favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

/**
 * @route   POST /api/favorites/check
 * @desc    Check if specific entities are favorited
 * @access  Private
 */
router.post('/check', authenticate, async (req, res) => {
  try {
    const { entityType, entityIds } = req.body;
    const userId = req.user.id;

    if (!entityType || !Array.isArray(entityIds)) {
      return res.status(400).json({ error: 'entityType and entityIds array are required' });
    }

    const favoritedSet = await UserFavorite.bulkCheckFavorites(userId, entityType, entityIds);

    // Convert Set to object with entity_id as key and boolean as value
    const result = {};
    entityIds.forEach(id => {
      result[id] = favoritedSet.has(id);
    });

    res.json(result);
  } catch (error) {
    console.error('Error checking favorites:', error);
    res.status(500).json({ error: 'Failed to check favorites' });
  }
});

module.exports = router;
