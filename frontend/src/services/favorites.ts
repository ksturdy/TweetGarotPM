import api from './api';

export interface Favorite {
  id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  created_at: string;
}

export interface ToggleFavoriteResponse {
  success: boolean;
  isFavorited: boolean;
  message: string;
}

export interface FavoriteStatusMap {
  [entityId: number]: boolean;
}

export const favoritesService = {
  /**
   * Toggle favorite status for an entity
   */
  async toggle(entityType: string, entityId: number): Promise<ToggleFavoriteResponse> {
    const response = await api.post('/favorites/toggle', {
      entityType,
      entityId,
    });
    return response.data;
  },

  /**
   * Get all favorites for a specific entity type
   */
  async getByType(entityType: string): Promise<Favorite[]> {
    const response = await api.get(`/favorites/${entityType}`);
    return response.data;
  },

  /**
   * Get all favorites for the current user (all types)
   */
  async getAll(): Promise<Favorite[]> {
    const response = await api.get('/favorites');
    return response.data;
  },

  /**
   * Check if specific entities are favorited (bulk check)
   */
  async checkMultiple(entityType: string, entityIds: number[]): Promise<FavoriteStatusMap> {
    const response = await api.post('/favorites/check', {
      entityType,
      entityIds,
    });
    return response.data;
  },

  /**
   * Get all favorited entity IDs for a specific type
   */
  async getFavoritedIds(entityType: string): Promise<number[]> {
    const favorites = await this.getByType(entityType);
    return favorites.map(f => f.entity_id);
  },
};

export default favoritesService;
