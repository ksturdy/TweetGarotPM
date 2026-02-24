const pool = require('../config/database');

const UserFavorite = {
  /**
   * Toggle favorite status for a user on an entity
   * @param {number} userId - The user's ID
   * @param {string} entityType - Type of entity ('project', 'customer', 'estimate', etc.)
   * @param {number} entityId - ID of the entity
   * @returns {Promise<{isFavorited: boolean}>} - New favorite status
   */
  async toggle(userId, entityType, entityId) {
    const client = await pool.getClient();
    try {
      // Check if already favorited
      const checkResult = await client.query(
        'SELECT id FROM user_favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3',
        [userId, entityType, entityId]
      );

      if (checkResult.rows.length > 0) {
        // Remove favorite
        await client.query(
          'DELETE FROM user_favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3',
          [userId, entityType, entityId]
        );
        return { isFavorited: false };
      } else {
        // Add favorite
        await client.query(
          'INSERT INTO user_favorites (user_id, entity_type, entity_id) VALUES ($1, $2, $3)',
          [userId, entityType, entityId]
        );
        return { isFavorited: true };
      }
    } finally {
      client.release();
    }
  },

  /**
   * Check if an entity is favorited by a user
   * @param {number} userId - The user's ID
   * @param {string} entityType - Type of entity
   * @param {number} entityId - ID of the entity
   * @returns {Promise<boolean>} - True if favorited
   */
  async isFavorited(userId, entityType, entityId) {
    const result = await pool.query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3',
      [userId, entityType, entityId]
    );
    return result.rows.length > 0;
  },

  /**
   * Get all favorites for a user by entity type
   * @param {number} userId - The user's ID
   * @param {string} entityType - Type of entity (optional)
   * @returns {Promise<Array>} - Array of favorite records
   */
  async getUserFavorites(userId, entityType = null) {
    let query = 'SELECT * FROM user_favorites WHERE user_id = $1';
    const params = [userId];

    if (entityType) {
      query += ' AND entity_type = $2';
      params.push(entityType);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Get all entity IDs favorited by a user for a specific type
   * @param {number} userId - The user's ID
   * @param {string} entityType - Type of entity
   * @returns {Promise<Array<number>>} - Array of entity IDs
   */
  async getFavoritedIds(userId, entityType) {
    const result = await pool.query(
      'SELECT entity_id FROM user_favorites WHERE user_id = $1 AND entity_type = $2',
      [userId, entityType]
    );
    return result.rows.map(row => row.entity_id);
  },

  /**
   * Bulk check if entities are favorited
   * @param {number} userId - The user's ID
   * @param {string} entityType - Type of entity
   * @param {Array<number>} entityIds - Array of entity IDs to check
   * @returns {Promise<Set<number>>} - Set of favorited entity IDs
   */
  async bulkCheckFavorites(userId, entityType, entityIds) {
    if (!entityIds || entityIds.length === 0) {
      return new Set();
    }

    const result = await pool.query(
      'SELECT entity_id FROM user_favorites WHERE user_id = $1 AND entity_type = $2 AND entity_id = ANY($3)',
      [userId, entityType, entityIds]
    );

    return new Set(result.rows.map(row => row.entity_id));
  },

  /**
   * Remove all favorites for an entity (e.g., when entity is deleted)
   * @param {string} entityType - Type of entity
   * @param {number} entityId - ID of the entity
   * @returns {Promise<void>}
   */
  async removeAllForEntity(entityType, entityId) {
    await pool.query(
      'DELETE FROM user_favorites WHERE entity_type = $1 AND entity_id = $2',
      [entityType, entityId]
    );
  }
};

module.exports = UserFavorite;
