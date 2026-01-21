# Render Deployment Guide

This guide covers deploying the Tweet Garot PM application to Render.

## Quick Fix for Current Crash

Your backend is crashing due to database connection issues. Here's the immediate fix:

### Step 1: Check Environment Variables in Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your **tweetgarot-backend** service
3. Go to **Environment** tab
4. Verify these variables are set:

```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secure-random-string
NODE_ENV=production
PORT=10000
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Optional, for AI features
```

### Step 2: Check Database Connection

1. In Render Dashboard, go to your PostgreSQL database
2. Copy the **External Database URL**
3. Ensure `DATABASE_URL` in backend environment matches this exactly

### Step 3: Clear Build Cache & Redeploy

1. In your backend service, go to **Settings** → **Build & Deploy**
2. Click **Clear Build Cache**
3. Go to **Manual Deploy** → **Deploy latest commit**

### Step 4: Monitor Logs

After redeploying, watch the logs for:
- ✅ `Database connected successfully at: [timestamp]`
- ✅ `Server running on port 10000 in production mode`
- ❌ `Database connection failed:` (indicates DATABASE_URL issue)

## Architecture

This project uses **render.yaml** for infrastructure-as-code deployment:

```
TweetGarotPM/
├── render.yaml          # Render configuration
├── backend/             # Node.js API
└── frontend/            # React static site
```

### Services Defined in render.yaml

1. **tweetgarot-backend** (Web Service)
   - Type: Node.js web service
   - Build: `npm install` in backend directory
   - Start: `npm run start:production` (runs migrations + starts server)
   - Port: 10000

2. **tweetgarot-frontend** (Static Site)
   - Type: Static site
   - Build: `npm install && npm run build` in frontend directory
   - Publish: `frontend/build` directory

## Initial Setup

### 1. Connect Repository to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Blueprint**
3. Connect your GitHub repository
4. Render will detect `render.yaml` and show both services
5. Click **Apply** to create both services

### 2. Create PostgreSQL Database

1. Click **New** → **PostgreSQL**
2. Name: `tweetgarot-pm-db`
3. Database: `tweetgarot_pm`
4. User: (auto-generated)
5. Region: Same as your backend service
6. Plan: Free (or paid for production)
7. Click **Create Database**

### 3. Link Database to Backend

1. Copy the **External Database URL** from your database page
2. Go to backend service → **Environment**
3. Add environment variable:
   - Key: `DATABASE_URL`
   - Value: (paste the database URL)

### 4. Set Required Environment Variables

In backend service → **Environment**, add:

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database  # From step 3
JWT_SECRET=your-random-secret-at-least-32-chars             # Generate with: openssl rand -base64 32
NODE_ENV=production
PORT=10000

# Optional (for AI contract analysis)
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Get from console.anthropic.com
```

### 5. Update Frontend API URL

In frontend service → **Environment**, add:

```bash
REACT_APP_API_URL=https://tweetgarot-backend.onrender.com/api
```

Replace `tweetgarot-backend` with your actual backend service name.

### 6. Deploy

Render will automatically deploy when you:
- Push to your default branch (usually `main` or `master`)
- Or manually trigger deploy from dashboard

## Database Migrations

The `start:production` script automatically runs migrations on startup:

```json
"start:production": "node src/migrations/run.js && node src/index.js"
```

This ensures your database schema is always up-to-date on each deployment.

### Manual Migration (if needed)

If you need to run migrations manually:

1. Go to backend service → **Shell**
2. Run:
   ```bash
   cd backend
   npm run migrate
   ```

## Troubleshooting

### ❌ Instance Failed: d8pfw (Crash Loop)

**Symptoms:**
- Service keeps restarting
- Logs show "Instance failed"
- No startup messages in logs

**Common Causes & Fixes:**

#### 1. Database Connection Failed

**Check:**
```bash
# Look for this error in logs:
❌ Database connection failed: connection to server at "..." failed
```

**Fix:**
- Verify `DATABASE_URL` is set correctly
- Check database is running and accessible
- Ensure database allows connections from Render IPs
- Add `?sslmode=require` to DATABASE_URL if needed:
  ```
  postgresql://user:password@host:port/database?sslmode=require
  ```

#### 2. Missing Environment Variables

**Check:**
```bash
# Look for this in startup logs:
❌ Missing database configuration
❌ JWT_SECRET not set in production
```

**Fix:**
- Go to Environment tab
- Add all required variables listed above
- Redeploy

#### 3. Native Module Compilation Failed

**Symptoms:**
- Build logs show errors compiling `better-sqlite3` or other native modules
- Error: "Module did not self-register"

**Fix:**
- This has been fixed by removing `better-sqlite3` from dependencies
- If you still see this, run: `npm install --production=false` (already in render.yaml)

#### 4. Port Binding Error

**Symptoms:**
```bash
Error: listen EADDRINUSE: address already in use :::3001
```

**Fix:**
- Ensure `PORT` environment variable is set to `10000`
- Render requires services to listen on port `10000`

### ❌ Build Failed

**Check build logs for:**

#### Missing Dependencies
```bash
Error: Cannot find module 'express'
```

**Fix:** Ensure all dependencies are in `dependencies` (not `devDependencies`)

#### Out of Memory
```bash
JavaScript heap out of memory
```

**Fix:** Upgrade to a paid plan or optimize build process

### ❌ API Routes Return 404

**Symptoms:**
- Frontend loads but API calls fail
- Network tab shows 404 for `/api/*` requests

**Fix:**
1. Verify frontend `REACT_APP_API_URL` points to backend URL
2. Check backend service is running
3. Test backend health: `https://your-backend.onrender.com/api/health`

### ❌ CORS Errors

**Symptoms:**
```
Access to fetch at 'https://backend.onrender.com/api/...' from origin 'https://frontend.onrender.com' has been blocked by CORS policy
```

**Fix:**
Backend already has CORS enabled for all origins. If you need to restrict:

```javascript
// backend/src/index.js
app.use(cors({
  origin: ['https://your-frontend.onrender.com', 'https://your-custom-domain.com']
}));
```

### ⚠️ Slow Cold Starts

**Symptoms:**
- First request after inactivity takes 30+ seconds
- Service spins down after 15 minutes of no traffic (free tier)

**Solutions:**
1. **Upgrade to paid plan** (keeps service always running)
2. **Keep-alive service** (ping your backend every 14 minutes)
3. **Use cron job** (external service to keep it warm)

## Environment-Specific Considerations

### Free Tier Limitations

- **Spin down after 15 minutes** of inactivity
- **750 hours/month** of runtime (enough for one service)
- **100GB bandwidth/month**
- **Cold starts** of 30-60 seconds

### Production Recommendations

1. **Use paid plan** ($7/month) for zero downtime
2. **Enable auto-deploy** from main branch
3. **Set up health checks** (already included: `/api/health`)
4. **Configure custom domain** for better branding
5. **Use Cloudflare R2** for file uploads (Render has limited disk space)

### Cloudflare R2 Setup (Recommended for Production)

Add these environment variables:

```bash
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=tweetgarot-pm-files
CLOUDFLARE_R2_REGION=auto
```

See [backend/R2_SETUP.md](backend/R2_SETUP.md) for detailed setup instructions.

## Monitoring & Logs

### View Logs

1. Go to service → **Logs** tab
2. Filter by:
   - **Build logs**: See installation/compilation
   - **Deploy logs**: See migration and startup
   - **Service logs**: See runtime errors

### Key Log Messages

**Successful startup:**
```
✅ Database connected successfully at: 2026-01-21T12:00:00.000Z
🚀 Server running on port 10000 in production mode
✅ Server started
✅ Configuration: 0 errors, 0 warnings
✅ Database configured
✅ Anthropic API (AI features)
```

**Failed startup (missing DB):**
```
❌ Database connection failed: connection refused
❌ Missing database configuration
⚠️ Server starting with configuration errors
```

### Health Check Endpoints

Test these in your browser or with `curl`:

1. **API Health**: `https://your-backend.onrender.com/api/health`
   - Expected: `{"status":"ok","timestamp":"..."}`

2. **Claude API Config**: `https://your-backend.onrender.com/api/contract-reviews/claude-config`
   - Expected: `{"hasServerKey":true}` (if ANTHROPIC_API_KEY is set)

3. **Root**: `https://your-backend.onrender.com/`
   - Expected: `{"name":"Tweet Garot PM API","status":"running",...}`

## Deployment Workflow

### Automatic Deployments

Every push to `main` branch triggers:
1. **Build**: `npm install` in backend and frontend
2. **Migrate**: `npm run migrate` in backend
3. **Start**: Server starts on port 10000
4. **Health check**: Render pings `/api/health`

### Manual Deployment

1. Go to service → **Manual Deploy**
2. Select branch
3. Click **Deploy**

### Rollback

1. Go to service → **Deploys**
2. Find previous successful deploy
3. Click **⋯** → **Rollback to this version**

## Custom Domain Setup (Optional)

1. Go to service → **Settings** → **Custom Domains**
2. Click **Add Custom Domain**
3. Enter your domain (e.g., `app.tweetgarot.com`)
4. Add CNAME record to your DNS:
   ```
   CNAME: app.tweetgarot.com → your-service.onrender.com
   ```
5. Wait for DNS propagation (up to 48 hours)
6. Render automatically provisions SSL certificate

## Security Best Practices

1. **Use strong JWT_SECRET** (at least 32 random characters)
2. **Rotate secrets periodically** (every 90 days)
3. **Use environment variables** for all secrets (never commit to Git)
4. **Enable HTTPS only** (Render enforces this by default)
5. **Restrict CORS origins** in production
6. **Use prepared statements** (already done via pg library)

## Cost Optimization

### Free Tier Strategy

- **One service free**: Use free tier for backend OR frontend (not both)
- **External hosting for frontend**: Use Vercel/Netlify (free tier) for frontend
- **Keep backend on Render**: API services work better on Render

### Paid Plan ($7/month)

- **No cold starts**: Always-on service
- **Better performance**: Faster response times
- **More resources**: 512MB RAM minimum

## Common Questions

### Q: How do I see what's causing the crash?

**A:** Go to service → **Logs** → Look for:
- Red error messages (`❌`)
- Stack traces
- Database connection errors
- Missing environment variables

### Q: Why does my service keep spinning down?

**A:** Free tier services spin down after 15 minutes of inactivity. Upgrade to paid plan or use a keep-alive service.

### Q: How do I run migrations?

**A:** They run automatically on startup. For manual: Service → **Shell** → `npm run migrate`

### Q: Can I use SQLite instead of PostgreSQL?

**A:** Not recommended. Render's ephemeral filesystem means SQLite data will be lost on redeploys.

### Q: How do I increase file upload size limit?

**A:** Use Cloudflare R2 (recommended) or upgrade Render plan for more disk space.

## Next Steps After Fixing Crash

1. ✅ Verify all environment variables are set
2. ✅ Check database connection in logs
3. ✅ Test API health endpoint
4. ✅ Test frontend can reach backend
5. ✅ Test file uploads work
6. ✅ Test AI contract analysis (if ANTHROPIC_API_KEY is set)
7. Set up Cloudflare R2 for production file storage
8. Configure custom domain
9. Set up monitoring/alerts

## Support

If issues persist after following this guide:

1. **Check Render Status**: https://status.render.com/
2. **Render Docs**: https://render.com/docs
3. **View detailed logs** in Render dashboard
4. **Check recent commits** for breaking changes
