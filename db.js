require('dotenv').config();
const { Pool } = require('pg');

// Create a connection pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || "odoo cafe",
  password: process.env.DB_PASSWORD || 'root',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Export for use in other files
module.exports = pool;

