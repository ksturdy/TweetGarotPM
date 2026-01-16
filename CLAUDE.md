# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tweet Garot PM is a construction project management system for Tweet Garot Mechanical. It tracks Projects, RFIs, Submittals, Change Orders, Daily Reports, and Schedule items.

## Tech Stack

- **Frontend**: React 18 with TypeScript, React Router, TanStack Query, Axios
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT-based auth with bcrypt password hashing

## Development Commands

### Backend (from `/backend`)
```bash
npm install              # Install dependencies
npm run dev              # Start dev server with nodemon (port 3001)
npm start                # Start production server
npm test                 # Run Jest tests
npm run migrate          # Run database migrations
npm run seed             # Populate database with test data
npm run lint             # Run ESLint
```

### Frontend (from `/frontend`)
```bash
npm install              # Install dependencies
npm start                # Start dev server (port 3000)
npm run build            # Production build
npm test                 # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
npm run lint             # Run ESLint
```

### Database Setup
1. Create PostgreSQL database named `tweetgarot_pm`
2. Copy `backend/.env.example` to `backend/.env` and configure credentials
3. Run `npm run migrate` from backend directory
4. Run `npm run seed` to populate test data (optional)

### Test Accounts (after seeding)
| Email | Password | Role |
|-------|----------|------|
| admin@tweetgarot.com | password123 | Admin |
| jsmith@tweetgarot.com | password123 | Manager |
| sgarcia@tweetgarot.com | password123 | Manager |
| bwilson@tweetgarot.com | password123 | User |
| emartinez@tweetgarot.com | password123 | User |

## Architecture

### Backend Structure
```
backend/src/
├── config/          # Database and app configuration
├── middleware/      # Express middleware (auth, errorHandler)
├── migrations/      # SQL migration files
├── models/          # Data access layer (one file per entity)
├── routes/          # Express route handlers (one file per module)
└── index.js         # Application entry point
```

**Data Flow**: Routes → Models → Database (no separate controller layer)

### Frontend Structure
```
frontend/src/
├── components/      # Reusable UI components organized by module
├── context/         # React context providers (AuthContext)
├── hooks/           # Custom React hooks
├── pages/           # Page components matching routes
├── services/        # API client functions (one file per module)
└── App.tsx          # Root component with routing
```

**State Management**: TanStack Query for server state, React Context for auth state

## API Conventions

- Base URL: `/api`
- Authentication: Bearer token in Authorization header
- All module routes follow RESTful patterns
- Routes for project-scoped items: `/api/{module}/project/:projectId`

### Module Endpoints
| Module | Base Route |
|--------|------------|
| Auth | `/api/auth` |
| Projects | `/api/projects` |
| RFIs | `/api/rfis` |
| Submittals | `/api/submittals` |
| Change Orders | `/api/change-orders` |
| Daily Reports | `/api/daily-reports` |
| Schedule | `/api/schedule` |

## Database Schema

Core entities with foreign key relationships:
- `users` - Authentication and role management (admin, manager, user)
- `projects` - Central entity, all modules link to projects
- `rfis` - Request for Information tracking
- `submittals` - Shop drawing and product data submissions
- `change_orders` - Contract modifications with cost/time impact
- `daily_reports` - Field activity logs (one per project per day)
- `schedule_items` - Hierarchical task scheduling with progress tracking
- `attachments` - Polymorphic file storage for any entity

## Key Patterns

- Auto-incrementing document numbers per project (RFI #1, #2, etc.)
- Submittal review workflow: pending → under_review → approved/rejected
- Change order workflow: draft → pending → approved/rejected
- Schedule items support parent-child hierarchy for WBS structure
