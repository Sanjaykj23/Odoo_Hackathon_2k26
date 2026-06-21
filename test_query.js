const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/odoo_cafe',
});

async function run() {
  try {
    const q1 = `SELECT o.*, (SELECT string_agg(t.table_number::text, ', ') FROM tables t WHERE t.id::text = ANY(string_to_array(o.table_id, ','))) as table_number FROM orders o`;
    const res = await pool.query(q1);
    console.log('Success q1', res.rows.length);
  } catch (err) {
    console.error('Error q1:', err.message);
  }
  process.exit();
}

run();
