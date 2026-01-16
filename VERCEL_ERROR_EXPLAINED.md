# Understanding the Vercel NOT_FOUND Error: A Deep Dive

## 1. The Fix Summary

**Problem:** Single `vercel.json` trying to build both frontend and backend from root directory

**Solution:** Create **two separate Vercel projects**, each pointing to its respective directory:
- Frontend project → Root Directory: `frontend/`
- Backend project → Root Directory: `backend/`

**Files Changed:**
- [vercel.json](vercel.json) - Simplified to minimal root config
- [backend/vercel.json](backend/vercel.json) - Backend serverless configuration
- [frontend/vercel.json](frontend/vercel.json) - Frontend with API rewrites

---

## 2. Root Cause Analysis

### What the Code Was Actually Doing

Your original `vercel.json` attempted to:
```json
{
  "builds": [
    {"src": "frontend/package.json", "use": "@vercel/static-build"},
    {"src": "backend/src/index.js", "use": "@vercel/node"}
  ]
}
```

This tells Vercel: "Build both frontend and backend from the **root directory**"

### What It Needed to Do

Vercel's monorepo model requires:
- **Separate projects** for each deployable directory
- Each project has its **Root Directory** set in the dashboard
- Each directory is treated as an **independent deployment**

### What Triggered the NOT_FOUND Error

1. **Build Process Confusion:**
   - Vercel looked for `frontend/package.json` from the root
   - But the **Root Directory wasn't set**, so it didn't know where to start
   - The build artifacts (`frontend/build/`) were never created in the expected location

2. **Routing Mismatch:**
   ```json
   {"src": "/(.*)", "dest": "frontend/build/$1"}
   ```
   - Tried to serve files from `frontend/build/`
   - But from Vercel's perspective, it was looking in the **wrong place**
   - Result: 404 NOT_FOUND for all routes

3. **Module Resolution:**
   - Backend tried to load from `backend/src/index.js`
   - Node modules and dependencies weren't in the expected path
   - Serverless function couldn't initialize

### The Misconception

**Common misconception:** "I can deploy a monorepo as a single Vercel project by using builds and routes in vercel.json"

**Reality:** Vercel's architecture requires **one project per deployable unit**. The `builds` array in `vercel.json` is for building **multiple outputs within a single directory**, not for combining separate applications.

---

## 3. The Underlying Concept

### Why This Error Exists

Vercel's serverless architecture is designed around **isolation and independence**:

1. **Build Isolation:**
   - Each deployment has its own build environment
   - Dependencies are installed fresh per project
   - This prevents conflicts between frontend and backend dependencies

2. **Function Isolation:**
   - Each serverless function runs in its own container
   - Memory, CPU, and execution limits are per-function
   - Frontend static assets and backend APIs scale independently

3. **Deployment Independence:**
   - Frontend and backend can deploy separately
   - Changes to one don't force rebuilding the other
   - Each has its own rollback capability

### What Vercel Is Protecting You From

1. **Dependency Conflicts:**
   - Frontend might need React 18
   - Backend might need a conflicting package version
   - Separate projects = separate `node_modules`

2. **Build Complexity:**
   - Mixing static builds with serverless functions in one project is error-prone
   - Separate projects enforce clear boundaries

3. **Scalability Issues:**
   - Static assets (CDN) scale differently than serverless functions
   - Separating them allows proper caching and edge optimization

### The Correct Mental Model

Think of Vercel projects like **microservices**:

```
Monorepo (Git Repository)
│
├── frontend/  ────────→  Vercel Project 1 (Static Site)
│                         - Builds to CDN
│                         - Serves HTML/CSS/JS
│                         - Proxies /api to Project 2
│
└── backend/   ────────→  Vercel Project 2 (Serverless API)
                          - Express app as functions
                          - Database connections
                          - API endpoints
```

**Key insight:** The monorepo is a **source code organization strategy**, not a deployment strategy. Vercel treats each directory as a separate application.

---

## 4. Warning Signs to Watch For

### Patterns That Indicate This Issue

🚩 **Red Flag #1: Builds Array with Different Directories**
```json
"builds": [
  {"src": "app1/...", ...},
  {"src": "app2/...", ...}
]
```
This suggests you're trying to deploy multiple apps as one project.

🚩 **Red Flag #2: Routes Pointing to Multiple Directories**
```json
"routes": [
  {"src": "/api/(.*)", "dest": "backend/..."},
  {"src": "/(.*)", "dest": "frontend/..."}
]
```
Cross-directory routing = monorepo that needs separate projects.

🚩 **Red Flag #3: Different Package.json Files**
If you have:
```
project/
├── frontend/package.json
└── backend/package.json
```
You likely need **two Vercel projects**, not one.

🚩 **Red Flag #4: Build Errors About Missing Files**
```
Error: Cannot find module './frontend/build/index.html'
```
This means Vercel is looking in the wrong directory - Root Directory not set correctly.

### Similar Mistakes in Related Scenarios

1. **Trying to deploy Next.js + Express as one project**
   - Solution: Deploy Next.js frontend separately, Express backend separately

2. **Workspace monorepo with multiple apps**
   - Each app directory = separate Vercel project
   - Use workspaces for shared dependencies, not deployment

3. **Full-stack frameworks (Next.js API routes)**
   - These work in one project because they're **designed** for it
   - Custom Express + React combo is not

### Code Smells

```javascript
// In Express app
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/build')));
}
```

This pattern (serving frontend from backend) works locally but breaks on Vercel because:
- Frontend build directory won't exist in backend's serverless function
- Static files should be on CDN, not served by Express

---

## 5. Alternative Approaches & Trade-offs

### Approach 1: Two Separate Vercel Projects (RECOMMENDED) ✅

**What we implemented:**
- Backend: Vercel project with Root Directory = `backend/`
- Frontend: Vercel project with Root Directory = `frontend/`
- Frontend rewrites `/api/*` to backend URL

**Pros:**
- ✅ Independent scaling (CDN for static, serverless for API)
- ✅ Independent deployments (deploy backend without rebuilding frontend)
- ✅ Clear separation of concerns
- ✅ Optimal performance (edge caching for frontend)
- ✅ Easy rollbacks (rollback frontend or backend independently)

**Cons:**
- ❌ Requires configuring backend URL in frontend
- ❌ Two projects to manage in Vercel dashboard
- ❌ Need to set up "Related Projects" for preview deployments

**When to use:** Almost always for production monorepos

---

### Approach 2: Merge into Single Next.js Project

**How it works:**
- Migrate frontend to Next.js
- Use Next.js API routes instead of Express
- Deploy as single Vercel project

**Pros:**
- ✅ Single deployment
- ✅ Built-in API routing
- ✅ Server-side rendering capabilities
- ✅ Simpler Vercel configuration

**Cons:**
- ❌ Complete rewrite of frontend (React → Next.js)
- ❌ Complete rewrite of backend (Express → Next.js API routes)
- ❌ Less flexible for complex backend logic
- ❌ Coupled frontend and backend (can't deploy separately)

**When to use:** Greenfield projects or major refactors

---

### Approach 3: Backend Serves Frontend (Monolith)

**How it works:**
- Build frontend locally
- Copy `build/` folder to backend
- Express serves static files
- Deploy backend as single Vercel project

**Pros:**
- ✅ Single deployment
- ✅ No CORS configuration needed
- ✅ Simple local development

**Cons:**
- ❌ Frontend not on CDN (slower loading)
- ❌ Backend serverless functions must serve static content (inefficient)
- ❌ Every frontend change requires backend redeploy
- ❌ Vercel serverless functions have 50MB size limit (frontend build can exceed this)
- ❌ Poor performance compared to CDN-served static files

**When to use:** Prototypes, internal tools, very small projects

---

### Approach 4: Separate Git Repositories

**How it works:**
- Split monorepo into two repos: `frontend-repo` and `backend-repo`
- Each repo = separate Vercel project
- Manage separately

**Pros:**
- ✅ Complete independence
- ✅ Easier access control (different teams)
- ✅ Simpler CI/CD per repo

**Cons:**
- ❌ Harder to coordinate changes across frontend and backend
- ❌ Code sharing requires npm packages
- ❌ More repos to manage
- ❌ Versioning synchronization challenges

**When to use:** Large teams with separate frontend/backend ownership

---

### Approach 5: Keep Monorepo, Use Different Platform

**Alternatives to Vercel:**
- **Render:** Better monorepo support, can deploy from subdirectories
- **Railway:** Supports multiple services in one repo
- **Fly.io:** Dockerfile-based, full control
- **Heroku:** Buildpack-based, can handle monorepos

**Pros:**
- ✅ May have simpler monorepo configuration
- ✅ More control over deployment process

**Cons:**
- ❌ Miss out on Vercel's edge network
- ❌ Different pricing model
- ❌ You already have Vercel set up

**When to use:** If Vercel's model doesn't fit your needs

---

## Comparison Matrix

| Approach | Complexity | Performance | Flexibility | Best For |
|----------|-----------|-------------|-------------|----------|
| **Two Projects** | Medium | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Production apps |
| Next.js Rewrite | High | ⭐⭐⭐⭐ | ⭐⭐⭐ | New projects |
| Backend Serves | Low | ⭐⭐ | ⭐⭐ | Prototypes |
| Separate Repos | High | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Large teams |
| Other Platform | Medium | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Specific needs |

---

## Final Recommendation

For your **Tweet Garot PM** project, **Approach 1 (Two Separate Vercel Projects)** is the best choice because:

1. ✅ You already have React + Express architecture
2. ✅ Minimal code changes required
3. ✅ Best performance (CDN + serverless)
4. ✅ Independent scaling and deployments
5. ✅ Aligns with Vercel's architecture

The key is understanding: **Monorepo ≠ Monolithic Deployment**. Keep your monorepo structure for code organization, but deploy as microservices.
