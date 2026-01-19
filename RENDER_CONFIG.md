# Render Deployment Configuration

This document describes the required environment variables for deploying to Render.

## Backend Service (tweetgarot-backend)

Configure these in Render Dashboard → Backend Service → Environment:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | Auto-configured by Render Postgres |
| `JWT_SECRET` | Yes | Secret key for JWT token signing | Generate a secure random string |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for contract reviews | `sk-ant-api03-...` |

**Note**: `JWT_SECRET` must remain consistent. Changing it will invalidate all user sessions.

## Frontend Service (tweetgarot-frontend)

Configure these in Render Dashboard → Frontend Service → Environment:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `REACT_APP_API_URL` | Yes | Backend API URL | `https://tweetgarot-backend.onrender.com/api` |

### Finding Your Backend URL

1. Go to Render Dashboard
2. Open your **tweetgarot-backend** service
3. Copy the URL shown at the top (e.g., `https://tweetgarot-backend.onrender.com`)
4. Add `/api` to the end
5. Use this full URL as `REACT_APP_API_URL`

## Troubleshooting

### Frontend shows "Failed to load resource: localhost:3001"
- **Cause**: `REACT_APP_API_URL` is not set in frontend environment
- **Fix**: Add the backend URL to frontend environment variables in Render dashboard

### PDF Viewer shows 401 Unauthorized
- **Cause**: JWT token signed with different secret
- **Fix**: Users need to log out and log back in after backend deployments

### Contract Review returns generic results
- **Cause**: `ANTHROPIC_API_KEY` not set in backend environment
- **Fix**: Add API key to backend environment variables in Render dashboard

### Page refresh returns 404
- **Cause**: SPA routing not configured
- **Fix**: Already handled by 404.html redirect (included in codebase)
