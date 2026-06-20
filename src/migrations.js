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

    // 4. Add customer_name, guest_count, and ticket_url to orders table
    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS guest_count INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS ticket_url VARCHAR(512);
    `);

    // 5. Update orders status CHECK constraint to allow 'To Pay'
    try {
      await client.query(`
        ALTER TABLE orders
        DROP CONSTRAINT IF EXISTS orders_status_check;
      `);
      await client.query(`
        ALTER TABLE orders
        ADD CONSTRAINT orders_status_check CHECK (status IN ('Draft', 'Paid', 'Cancelled', 'To Pay'));
      `);
    } catch (constraintErr) {
      console.warn('[Migration] Warning updating orders_status_check constraint:', constraintErr.message);
    }

    // 6. Ensure payments table has transaction_ref and status
    await client.query(`
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(255),
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Success';
    `);

    // 7. Ensure tables have qr_token column and backfill NULLs with generated tokens
    await client.query(`
      ALTER TABLE tables
      ADD COLUMN IF NOT EXISTS qr_token VARCHAR(255);
    `);
    // Backfill any tables that are missing a qr_token
    const nullTokenTables = await client.query(
      `SELECT id FROM tables WHERE qr_token IS NULL OR qr_token = ''`
    );
    if (nullTokenTables.rows.length > 0) {
      console.log(`[Migration] Backfilling qr_token for ${nullTokenTables.rows.length} table(s)...`);
      const crypto = require('crypto');
      for (const row of nullTokenTables.rows) {
        const token = `qr_${row.id}_${crypto.randomBytes(6).toString('hex')}`;
        await client.query(`UPDATE tables SET qr_token = $1 WHERE id = $2`, [token, row.id]);
      }
      console.log('[Migration] qr_token backfill complete.');
    }

    console.log('Database schema migrations/verifications completed successfully.');
  } catch (err) {
    console.error('Error running database migrations:', err);
  } finally {
    client.release();
  }
}

module.exports = runMigrations;
