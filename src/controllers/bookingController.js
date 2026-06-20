const pool = require('../../db');
const crypto = require('crypto');

// 1. Get Table Info by QR Token
exports.getTableInfo = async (req, res) => {
  const { qrToken } = req.params;

  try {
    const result = await pool.query(
      `SELECT t.id as table_id, t.table_number, t.seats, f.shop_id, s.name as shop_name 
       FROM tables t
       JOIN floors f ON t.floor_id = f.id
       JOIN shops s ON f.shop_id = s.id
       WHERE t.qr_token = $1`,
      [qrToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid QR token. Table not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting table info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2. Initiate Booking (Check capacity)
exports.initiateBooking = async (req, res) => {
  const { qrToken } = req.params;
  const { requested_seats } = req.body;

  if (!requested_seats || requested_seats <= 0) {
    return res.status(400).json({ error: 'Valid requested_seats is required.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, seats FROM tables WHERE qr_token = $1`,
      [qrToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid QR token.' });
    }

    const table = result.rows[0];

    if (requested_seats > table.seats) {
      return res.status(400).json({ 
        error: 'Requested seats exceed table capacity. Please contact the waiter.' 
      });
    }

    res.json({ message: 'Seats available. Proceed to menu.' });
  } catch (err) {
    console.error('Error initiating booking:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. Submit Order via QR
exports.submitOrder = async (req, res) => {
  const { qrToken, customer_name, customer_phone, customer_email, items } = req.body;

  if (!qrToken || !customer_name || !customer_phone || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or empty cart.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find table and shop
    const tableRes = await client.query(
      `SELECT t.id as table_id, f.shop_id FROM tables t
       JOIN floors f ON t.floor_id = f.id
       WHERE t.qr_token = $1`,
      [qrToken]
    );

    if (tableRes.rows.length === 0) {
      throw new Error('Invalid QR token.');
    }

    const { table_id, shop_id } = tableRes.rows[0];

    // Find or create customer
    let customerId;
    const custCheck = await client.query(`SELECT id FROM customers WHERE phone_number = $1`, [customer_phone]);
    if (custCheck.rows.length > 0) {
      customerId = custCheck.rows[0].id;
    } else {
      const custInsert = await client.query(
        `INSERT INTO customers (name, email, phone_number) VALUES ($1, $2, $3) RETURNING id`,
        [customer_name, customer_email || null, customer_phone]
      );
      customerId = custInsert.rows[0].id;
    }

    // Generate Order ID
    const randomHex = crypto.randomBytes(3).toString('hex').toLowerCase();
    const orderId = `o-${Date.now().toString().slice(-6)}${randomHex}`;
    const orderNumber = `ORD-${Date.now()}`;

    // Calculate totals based on items (normally we'd fetch prices from DB to avoid client spoofing)
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const prodRes = await client.query(`SELECT price, tax FROM products WHERE id = $1`, [item.product_id]);
      if (prodRes.rows.length === 0) throw new Error(`Product ${item.product_id} not found`);
      
      const price = parseFloat(prodRes.rows[0].price);
      const qty = parseInt(item.quantity);
      const lineTotal = price * qty;
      subtotal += lineTotal;
      
      orderItemsData.push({
        product_id: item.product_id,
        quantity: qty,
        unit_price: price,
        line_total: lineTotal
      });
    }

    // simplified tax logic
    const tax = subtotal * 0.05; 
    const totalAmount = subtotal + tax;

    // Create Draft Order
    await client.query(
      `INSERT INTO orders (
        id, order_number, shop_id, customer_id, table_id, 
        subtotal, tax, total_amount, status, kds_status, order_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft', 'To Cook', 'Self-Order')`,
      [orderId, orderNumber, shop_id, customerId, table_id, subtotal, tax, totalAmount]
    );

    // Create Order Items
    for (const oi of orderItemsData) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, oi.product_id, oi.quantity, oi.unit_price, oi.line_total]
      );
    }

    await client.query('COMMIT');
    
    // Trigger WhatsApp notification asynchronously
    const whatsappService = require('../services/whatsappService');
    if (whatsappService && typeof whatsappService.sendOrderConfirmation === 'function') {
      whatsappService.sendOrderConfirmation(orderId).catch(err => {
        console.error('Error sending WhatsApp order confirmation:', err);
      });
    }
    
    res.status(201).json({
      message: 'Order created successfully',
      order_id: orderId,
      total_amount: totalAmount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error submitting order:', err);
    res.status(400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
};
