const pool = require('../db');

async function runMigrations() {
  console.log('Running database schema migrations/verifications...');
  const client = await pool.connect();
  try {
    // 1. Add is_active to shops
    await client.query(`
      ALTER TABLE shops 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);
    
    // 2. Add is_active to categories
    await client.query(`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);
    
    // 3. Add popularity, cost_index, country to products
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS popularity INT DEFAULT 4,
      ADD COLUMN IF NOT EXISTS cost_index INT DEFAULT 2,
      ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
    `);

    // 4. Add customer_name to orders table
    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
    `);

    console.log('Database schema migrations/verifications completed successfully.');
  } catch (err) {
    console.error('Error running database migrations:', err);
  } finally {
    client.release();
  }
}

module.exports = runMigrations;
