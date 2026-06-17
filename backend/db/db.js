const { Pool } = require('pg');
require('dotenv').config();

// Use the environment variable if it exists, otherwise fall back to local config
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test the connection on startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully!');
    client.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
})();

// The "Standard" way to export for a Multi-User app
module.exports = {
  query: (text, params) => pool.query(text, params), pool,
};