const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../../db');
const ticketService = require('../services/ticketService');
const socketService = require('../config/socket');

let razorpayInstance;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

// 1. Create Razorpay Order
exports.createRazorpayOrder = async (req, res) => {
  const { order_id } = req.body; // Our internal order ID (e.g. o-xxxxxx)

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  try {
    const orderRes = await pool.query(`SELECT total_amount FROM orders WHERE id = $1`, [order_id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const totalAmount = parseFloat(orderRes.rows[0].total_amount);
    const amountInPaise = Math.round(totalAmount * 100);

    if (!razorpayInstance) {
      // Mock mode for local testing without credentials
      console.warn('Razorpay credentials missing. Generating mock razorpay order id.');
      return res.json({
        id: `order_${crypto.randomBytes(6).toString('hex')}`,
        amount: amountInPaise,
        currency: "INR",
        key: 'rzp_test_mockkey',
        is_mock: true
      });
    }

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: order_id
    };

    const rzpOrder = await razorpayInstance.orders.create(options);
    res.json({
      ...rzpOrder,
      razorpay_order_id: rzpOrder.id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 2. Verify Razorpay Payment
exports.verifyRazorpayPayment = async (req, res) => {
  const { 
    razorpay_order_id, 
    razorpay_payment_id, 
    razorpay_signature, 
    order_id 
  } = req.body;

  try {
    // 1. Verify Signature (Skip if mock mode)
    if (razorpayInstance) {
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }
    }

    const client = await pool.connect();
    let orderDataForTicket = {};

    try {
      await client.query('BEGIN');

      // Update Order Status
      const orderUpdate = await client.query(
        `UPDATE orders SET status = 'Paid', payment_method = 'Card' 
         WHERE id = $1 RETURNING shop_id, order_number, total_amount, customer_id, table_id`,
        [order_id]
      );
      
      if (orderUpdate.rows.length === 0) throw new Error('Order not found');
      
      const orderData = orderUpdate.rows[0];

      // Insert into payments table
      await client.query(
        `INSERT INTO payments (order_id, amount, payment_method, transaction_ref, status)
         VALUES ($1, $2, 'Razorpay', $3, 'Success')`,
        [order_id, orderData.total_amount, razorpay_payment_id || 'mock_tx']
      );

      // Get Customer phone & Table info for ticket
      const custRes = await client.query(`SELECT phone_number FROM customers WHERE id = $1`, [orderData.customer_id]);
      const tableRes = await client.query(`SELECT table_number FROM tables WHERE id = $1`, [orderData.table_id]);
      const shopRes = await client.query(`SELECT name FROM shops WHERE id = $1`, [orderData.shop_id]);

      // Get Order Items
      const itemsRes = await client.query(
        `SELECT oi.quantity, oi.unit_price as price, p.name 
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id = $1`, 
        [order_id]
      );

      orderDataForTicket = {
        order_id: order_id,
        order_number: orderData.order_number,
        total_amount: orderData.total_amount,
        phone_number: custRes.rows[0]?.phone_number,
        table_number: tableRes.rows[0]?.table_number,
        shop_name: shopRes.rows[0]?.name,
        shop_id: orderData.shop_id,
        items: itemsRes.rows
      };

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // Post-payment actions (async)
    // 1. Notify Kitchen
    socketService.notifyKitchen(orderDataForTicket.shop_id, {
      order_id: order_id,
      order_number: orderDataForTicket.order_number,
      table_number: orderDataForTicket.table_number,
      message: 'New paid order received!'
    });

    // 2. Notify Customer (if they are listening on the order socket room)
    socketService.updateCustomerStatus(order_id, {
      status: 'Paid',
      message: 'Payment successful, kitchen is preparing your food.'
    });

    // 3. Send WhatsApp Ticket with Metro-Ticket Image
    const whatsappService = require('../services/whatsappService');
    if (whatsappService && typeof whatsappService.sendOrderConfirmation === 'function') {
      whatsappService.sendOrderConfirmation(order_id).catch(err => {
        console.error('Error sending WhatsApp order confirmation:', err);
      });
    }

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. COD Payment Route
exports.handleCOD = async (req, res) => {
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderUpdate = await client.query(
      `UPDATE orders SET status = 'To Pay', payment_method = 'Cash' 
       WHERE id = $1 RETURNING shop_id, order_number, table_id`,
      [order_id]
    );

    if (orderUpdate.rows.length === 0) throw new Error('Order not found');
    const orderData = orderUpdate.rows[0];

    const tableRes = await client.query(`SELECT table_number FROM tables WHERE id = $1`, [orderData.table_id]);
    const tableNum = tableRes.rows[0]?.table_number;

    await client.query('COMMIT');

    // Notify Admin to collect payment
    socketService.notifyAdminCOD(orderData.shop_id, {
      order_id: order_id,
      order_number: orderData.order_number,
      table_number: tableNum,
      message: 'Cash payment needs to be collected.'
    });

    // Notify Kitchen
    socketService.notifyKitchen(orderData.shop_id, {
      order_id: order_id,
      order_number: orderData.order_number,
      table_number: tableNum,
      message: 'New COD order received!'
    });

    res.json({ success: true, message: 'Order submitted as COD. Waiter will collect payment.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing COD:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
