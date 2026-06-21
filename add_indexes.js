const pool = require('./db');

async function addIndexes() {
  const client = await pool.connect();
  try {
    console.log('Adding database indexes for performance optimization...');
    
    // Index on shop_id for orders (speeds up filtering for specific shops)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);`);
    
    // Index on status for orders (speeds up fetching active vs paid orders)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
    
    // Index on order_id in order_items (speeds up JOINs when fetching order details)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);
    
    // Index on floor_id in tables (speeds up table grouping by floor)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tables_floor_id ON tables(floor_id);`);

    console.log('Database indexes successfully added!');
  } catch (err) {
    console.error('Error adding indexes:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

addIndexes();
