require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
// Version: 2026-01-21 - Fix database crash handler and add startup validation

// Handle uncaught exceptions and unhandled rejections gracefully
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
  // Log but don't exit - let the app continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
  // Log but don't exit - let the app continue
});

const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { isR2Enabled } = require('./config/r2Client');

// Import routes
const authRoutes = require('./routes/auth');
const securityRoutes = require('./routes/security');
const userRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const rfiRoutes = require('./routes/rfis');
const rfiActionRoutes = require('./routes/rfiActions');
const submittalRoutes = require('./routes/submittals');
const changeOrderRoutes = require('./routes/changeOrders');
const dailyReportRoutes = require('./routes/dailyReports');
const scheduleRoutes = require('./routes/schedule');
const historicalProjectRoutes = require('./routes/historicalProjects');
const customerRoutes = require('./routes/customers');
const chatRoutes = require('./routes/chat');
const companyRoutes = require('./routes/companies');
const contactRoutes = require('./routes/contacts');
const estimateRoutes = require('./routes/estimates');
const departmentRoutes = require('./routes/departments');
const officeLocationRoutes = require('./routes/officeLocations');
const employeeRoutes = require('./routes/employees');
const specificationRoutes = require('./routes/specifications');
const drawingRoutes = require('./routes/drawings');
const feedbackRoutes = require('./routes/feedback');
const contractReviewRoutes = require('./routes/contractReviews');
const opportunityRoutes = require('./routes/opportunities');
const vendorRoutes = require('./routes/vendors');
const campaignRoutes = require('./routes/campaigns');
const customerAssessmentRoutes = require('./routes/customerAssessments');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads (only when using local storage)
// When R2 is enabled, files are served via presigned URLs from download endpoints
if (!isR2Enabled()) {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  console.log('Using local file storage - serving static files from /uploads');
} else {
  console.log('Using Cloudflare R2 - files served via presigned URLs');
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/rfis', rfiRoutes);
app.use('/api/rfi-actions', rfiActionRoutes);
app.use('/api/submittals', submittalRoutes);
app.use('/api/change-orders', changeOrderRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/historical-projects', historicalProjectRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/office-locations', officeLocationRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/specifications', specificationRoutes);
app.use('/api/drawings', drawingRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/contract-reviews', contractReviewRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/customer-assessments', customerAssessmentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend files in production (if they exist)
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../../frontend/build');
  const frontendIndexPath = path.join(frontendBuildPath, 'index.html');

  if (fs.existsSync(frontendBuildPath) && fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendBuildPath));

    // Handle React routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      res.sendFile(frontendIndexPath);
    });
    console.log('Serving frontend build from:', frontendBuildPath);
  } else {
    console.log('Frontend build not found - running as API-only server');
    // Add a root route for API-only mode
    app.get('/', (req, res) => {
      res.json({
        name: 'Tweet Garot PM API',
        version: '1.0.0',
        status: 'running',
        mode: 'API-only',
        docs: '/api/health for health check',
      });
    });
  }
}

// Error handling
app.use(errorHandler);

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Validate critical environment variables on startup
function validateEnvironment() {
  const warnings = [];
  const errors = [];

  // Check database configuration
  if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
    errors.push('Missing database configuration: Set DATABASE_URL or DB_* variables');
  }

  // Check JWT secret in production
  if (config.nodeEnv === 'production' && config.jwt.secret === 'dev-secret-change-in-production') {
    errors.push('JWT_SECRET not set in production - using insecure default!');
  }

  // Warnings for optional features
  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY not set - AI features will be disabled');
  }

  if (!config.r2.accountId) {
    warnings.push('Cloudflare R2 not configured - using local file storage');
  }

  // Log warnings
  warnings.forEach(warning => console.warn('⚠️', warning));

  // Log errors
  if (errors.length > 0) {
    errors.forEach(error => console.error('❌', error));
    console.error('⚠️ Server starting with configuration errors - some features may not work');
  }

  return { warnings, errors };
}

// Start server
app.listen(config.port, () => {
  console.log(`\n🚀 Server running on port ${config.port} in ${config.nodeEnv} mode\n`);

  const { warnings, errors } = validateEnvironment();

  console.log('📊 Startup validation:');
  console.log(`  ✅ Server started`);
  console.log(`  ${errors.length === 0 ? '✅' : '❌'} Configuration: ${errors.length} errors, ${warnings.length} warnings`);
  console.log(`  ${process.env.DATABASE_URL || process.env.DB_PASSWORD ? '✅' : '❌'} Database configured`);
  console.log(`  ${process.env.ANTHROPIC_API_KEY ? '✅' : '⚠️'} Anthropic API (AI features)`);
  console.log(`  ${config.r2.accountId ? '✅' : '⚠️'} Cloudflare R2 (cloud storage)\n`);
});


