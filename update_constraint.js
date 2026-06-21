const pool = require('./db');

async function updateTablesConstraint() {
  const client = await pool.connect();
  try {
    console.log('Updating tables status constraint...');
    
    // In postgres, check constraints are usually named table_column_check
    await client.query(`ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_status_check;`);
    
    // Add new constraint
    await client.query(`ALTER TABLE tables ADD CONSTRAINT tables_status_check CHECK (status IN ('Available', 'Occupied', 'Partially Occupied', 'Reserved', 'Maintenance'));`);
    
    console.log('Successfully updated tables status constraint.');
  } catch (err) {
    console.error('Error modifying schema:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateTablesConstraint();
