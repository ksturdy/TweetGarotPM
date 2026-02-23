# Per-User Favorites System

## Overview

The favorites system has been updated to support **per-user favorites** instead of tenant-wide favorites. This means each user can maintain their own list of favorited items without affecting other users.

## Database Schema

### user_favorites Table

```sql
CREATE TABLE user_favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'project', 'customer', 'estimate', etc.
  entity_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, entity_type, entity_id)
);
```

## Backend API

### Endpoints

#### Toggle Favorite
```http
POST /api/favorites/toggle
Content-Type: application/json

{
  "entityType": "project",
  "entityId": 123
}
```

Response:
```json
{
  "success": true,
  "isFavorited": true,
  "message": "Added to favorites"
}
```

#### Get Favorites by Type
```http
GET /api/favorites/:entityType
```

Example: `GET /api/favorites/project`

#### Get All Favorites
```http
GET /api/favorites
```

#### Bulk Check Favorites
```http
POST /api/favorites/check
Content-Type: application/json

{
  "entityType": "project",
  "entityIds": [1, 2, 3, 4, 5]
}
```

Response:
```json
{
  "1": true,
  "2": false,
  "3": true,
  "4": false,
  "5": true
}
```

## Frontend Usage

### Import the Service

```typescript
import { favoritesService } from './services/favorites';
```

### Toggle Favorite

```typescript
const handleToggleFavorite = async (projectId: number) => {
  try {
    const result = await favoritesService.toggle('project', projectId);
    console.log(result.isFavorited); // true or false
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
  }
};
```

### Check if Items are Favorited

For a single list/page with multiple items:

```typescript
useEffect(() => {
  const checkFavorites = async () => {
    const projectIds = projects.map(p => p.id);
    const favoriteStatus = await favoritesService.checkMultiple('project', projectIds);

    // favoriteStatus is an object: { 1: true, 2: false, 3: true, ... }
    const updatedProjects = projects.map(project => ({
      ...project,
      isFavorited: favoriteStatus[project.id] || false
    }));
    setProjects(updatedProjects);
  };

  checkFavorites();
}, []);
```

### Get All Favorited IDs

```typescript
const favoritedProjectIds = await favoritesService.getFavoritedIds('project');
// Returns: [1, 3, 7, 12, ...]
```

## Supported Entity Types

- `project` - Projects
- `customer` - Customers
- `estimate` - Estimates
- `proposal` - Proposals
- `case_study` - Case Studies
- `contract_review` - Contract Reviews

To add support for new entity types, simply use the entity type string when calling the favorites API.

## Migration Notes

The migration (`088_create_user_favorites.sql`) will:

1. Create the new `user_favorites` table
2. Migrate existing favorites from `projects` and `customers` tables (will copy for ALL users in the tenant)
3. Remove the old `favorite` column from both tables
4. Drop the old indexes

**Important**: The migration assumes any existing favorites should be visible to all users in the tenant. If you need different behavior, modify the migration before running it.

## Frontend Interface Updates

Both `Project` and `Customer` interfaces now have:
- **Removed**: `favorite?: boolean` (deprecated)
- **Added**: `isFavorited?: boolean` (runtime property set by UI)

## Legacy Code

Old endpoints have been removed:
- ❌ `PATCH /api/projects/:id/favorite`
- ❌ `PATCH /api/customers/:id/favorite`

Use the new centralized favorites endpoints instead:
- ✅ `POST /api/favorites/toggle`
