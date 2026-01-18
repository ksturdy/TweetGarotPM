require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
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

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Only listen on a port if not running in serverless environment
if (process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  });
}

module.exports = app;
