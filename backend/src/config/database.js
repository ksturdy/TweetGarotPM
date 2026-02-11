const { Pool } = require('pg');

// Support both DATABASE_URL (Render) and individual connection params (local dev)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'tweetgarot_pm',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      // Enable SSL for Render hosts
      ...(process.env.DB_HOST && process.env.DB_HOST.includes('render.com')
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  // Don't exit immediately - let the app handle connection errors gracefully
  // The error will be caught when queries are attempted
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Configuration:', {
      usingDatabaseUrl: !!process.env.DATABASE_URL,
      host: poolConfig.host || 'from DATABASE_URL',
      port: poolConfig.port || 'from DATABASE_URL',
      database: poolConfig.database || 'from DATABASE_URL',
      ssl: poolConfig.ssl,
    });
  } else {
    console.log('✅ Database connected successfully at:', res.rows[0].now);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
