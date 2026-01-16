# Vercel Deployment Checklist

Follow this checklist to deploy your monorepo to Vercel correctly.

## ☐ Step 1: Update Frontend Configuration

1. After deploying backend (Step 2), update [frontend/vercel.json](frontend/vercel.json):
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://YOUR-ACTUAL-BACKEND-URL.vercel.app/api/:path*"
       }
     ]
   }
   ```
   Replace `YOUR-ACTUAL-BACKEND-URL` with your backend's Vercel URL.

## ☐ Step 2: Deploy Backend First

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Select your Git repository
4. **Set Root Directory to:** `backend`
5. Framework Preset: **Other**
6. Add Environment Variables:
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-secret-here
   NODE_ENV=production
   ```
7. Click **Deploy**
8. **Copy the deployment URL** (e.g., `https://tweet-garot-backend.vercel.app`)

## ☐ Step 3: Set Up Database

Choose one option:

### Option A: Vercel Postgres
1. In backend project → **Storage** → **Create Database**
2. Select **Postgres**
3. Copy connection string to `DATABASE_URL` environment variable

### Option B: External Database (Neon, Supabase, etc.)
1. Create PostgreSQL database on your provider
2. Get connection string
3. Add to backend environment variables

## ☐ Step 4: Run Database Migrations

```bash
# Update backend/.env with production DATABASE_URL
cd backend
npm run migrate
npm run seed  # Optional: test data
```

## ☐ Step 5: Update Frontend Config with Backend URL

```bash
# Edit frontend/vercel.json with the backend URL from Step 2
# Then commit:
git add frontend/vercel.json
git commit -m "Configure backend URL for frontend"
git push
```

## ☐ Step 6: Deploy Frontend

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Select **the same Git repository**
4. **Set Root Directory to:** `frontend`
5. Framework Preset: **Create React App** (should auto-detect)
6. Click **Deploy**

## ☐ Step 7: Test Deployment

1. Open frontend URL: `https://your-frontend.vercel.app`
2. Try logging in with test account:
   - Email: `admin@tweetgarot.com`
   - Password: `password123`
3. Check API calls work (open browser DevTools → Network tab)
4. Verify data loads from backend

## ☐ Step 8: Link Projects (Optional)

For automatic preview URLs:

1. In **frontend project** → **Settings** → **Git**
2. Scroll to **Connected Git Repository**
3. Add **backend project** as related project
4. Now preview deployments auto-link!

## ☐ Step 9: Configure Custom Domain (Optional)

### For Frontend:
1. Frontend project → **Settings** → **Domains**
2. Add your domain (e.g., `pm.tweetgarot.com`)
3. Update DNS as instructed

### For Backend:
1. Backend project → **Settings** → **Domains**
2. Add API subdomain (e.g., `api.tweetgarot.com`)
3. Update DNS
4. Update `frontend/vercel.json` with new backend URL

## ☐ Step 10: Update CORS (if using custom domain)

If you added a custom domain, update backend CORS:

```javascript
// backend/src/index.js
app.use(cors({
  origin: [
    'https://pm.tweetgarot.com',  // Your production domain
    'http://localhost:3000'        // Local development
  ]
}));
```

---

## Troubleshooting

### ❌ Frontend shows blank page
- Check browser console for errors
- Verify API calls are going to correct backend URL
- Check backend is deployed and responding

### ❌ API calls fail with CORS error
- Verify backend CORS configuration
- Check frontend is using correct backend URL in rewrites

### ❌ Database connection errors
- Verify `DATABASE_URL` is set in backend environment variables
- Check database allows connections from Vercel
- Add `?sslmode=require` to connection string if needed

### ❌ Build fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version compatibility

---

## Quick Reference

**Backend URL Pattern:** `https://[project-name]-[git-branch].vercel.app`

**Frontend URL Pattern:** `https://[project-name]-[git-branch].vercel.app`

**Environment Variables:**
- Set in: Project → **Settings** → **Environment Variables**
- Scope: Production, Preview, Development
- Changes require redeployment

**Redeploy:**
- Automatic: Push to Git
- Manual: Project → **Deployments** → ⋮ → **Redeploy**

---

## Success Indicators ✅

- [ ] Backend deploys successfully
- [ ] Frontend deploys successfully
- [ ] Can log in to the application
- [ ] API calls appear in Network tab and succeed
- [ ] Data loads from database
- [ ] No console errors
- [ ] Both URLs accessible

Once all checked, you're done! 🎉
