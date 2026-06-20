const pool = require('../../db');
const crypto = require('crypto');

// Create a new shop with tables
exports.createShop = async (req, res) => {
  const { name, address, phone, table_capacities } = req.body;

  if (!name || !table_capacities || !Array.isArray(table_capacities)) {
    return res.status(400).json({ error: 'Name and table_capacities array are required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the shop
    const shopResult = await client.query(
      `INSERT INTO shops (name, address, phone) VALUES ($1, $2, $3) RETURNING id`,
      [name, address, phone]
    );
    const shopId = shopResult.rows[0].id;

    // 2. Create a default floor for the shop
    const floorResult = await client.query(
      `INSERT INTO floors (shop_id, name) VALUES ($1, 'Main Floor') RETURNING id`,
      [shopId]
    );
    const floorId = floorResult.rows[0].id;

    // 3. Create tables
    const createdTables = [];
    for (let i = 0; i < table_capacities.length; i++) {
      const seats = table_capacities[i];
      const tableNumber = i + 1;
      const tableId = `tbl-${shopId}-${tableNumber}`;
      const qrToken = crypto.randomBytes(8).toString('hex'); // 16 char random hash

      const tableResult = await client.query(
        `INSERT INTO tables (id, floor_id, table_number, seats, status, qr_token) 
         VALUES ($1, $2, $3, $4, 'Available', $5) RETURNING id, qr_token, seats`,
        [tableId, floorId, tableNumber, seats, qrToken]
      );
      createdTables.push(tableResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Shop and tables created successfully.',
      shop_id: shopId,
      tables: createdTables
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating shop:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Update table capacities
exports.updateTableCapacities = async (req, res) => {
  const shopId = req.params.shopId;
  const { tables } = req.body; // Expecting array of { table_id, seats }

  if (!tables || !Array.isArray(tables)) {
    return res.status(400).json({ error: 'Expected an array of tables with table_id and seats.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const t of tables) {
      if (!t.table_id || !t.seats) continue;
      
      // We must ensure the table belongs to the shop
      await client.query(
        `UPDATE tables t 
         SET seats = $1 
         FROM floors f
         WHERE t.floor_id = f.id AND f.shop_id = $2 AND t.id = $3`,
        [t.seats, shopId, t.table_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Table capacities updated successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating table capacities:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
