const pool = require('../../db');
const sse = require('../middleware/sse');

// Helper to generate a ticket number if not provided
const generateTicketNumber = () => {
  return `T-${Math.floor(100 + Math.random() * 900)}`;
};

// 1. Create a New Order
const createOrder = async (req, res) => {
  const {
    id,
    ticketNumber,
    items,
    table_id,
    subtotal,
    tax,
    discount_amount,
    total_amount,
    payment_method,
    status,
    notes,
    customer_name
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  // Enforce mandatory table selection
  if (!table_id) {
    return res.status(400).json({ error: 'Table selection is mandatory to place an order.' });
  }

  // Deduce shop_id and employee_id from request token
  const shopId = req.user.shop_id;
  const targetShopId = shopId || req.body.shop_id;
  const employeeId = req.user.role !== 'Customer' ? req.user.id : null;

  if (!targetShopId) {
    return res.status(400).json({ error: 'shop_id is required.' });
  }

  const orderId = id || `o-${Date.now()}`;
  const tNumber = ticketNumber || generateTicketNumber();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch active session for the shop if employee is logging this
    let sessionId = null;
    if (employeeId) {
      const sessionRes = await client.query(
        `SELECT id FROM sessions WHERE shop_id = $1 AND status = 'Open' ORDER BY opening_date DESC LIMIT 1`,
        [targetShopId]
      );
      sessionId = sessionRes.rows[0]?.id || null;
      if (!sessionId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You must open a POS session before placing an order.' });
      }
    }

    // Insert Order Header
    const orderQuery = `
      INSERT INTO orders (
        id, order_number, shop_id, session_id, employee_id, customer_id, table_id, 
        subtotal, tax, discount_amount, total_amount, payment_method, status, kds_status, notes, customer_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'To Cook', $14, $15)
      RETURNING *
    `;
    const orderValues = [
      orderId,
      tNumber,
      targetShopId,
      sessionId,
      employeeId,
      req.body.customer_id || null,
      table_id,
      subtotal || 0.00,
      tax || 0.00,
      discount_amount || 0.00,
      total_amount || 0.00,
      payment_method || null,
      status || 'Draft',
      notes || null,
      customer_name || null
    ];

    const orderRes = await client.query(orderQuery, orderValues);
    const createdOrder = orderRes.rows[0];

    // Insert Order Items
    const itemInsertQuery = `
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total, fulfilled) 
      VALUES ($1, $2, $3, $4, $5, false)
    `;

    for (const item of items) {
      let uPrice = item.unit_price;
      if (uPrice === undefined) {
        const prodRes = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
        uPrice = prodRes.rows[0]?.price || 0.00;
      }
      const lTotal = item.line_total !== undefined ? item.line_total : (uPrice * item.quantity);
      await client.query(itemInsertQuery, [orderId, item.product_id, item.quantity, uPrice, lTotal]);
    }

    // Update table status to Occupied in DB
    await client.query("UPDATE tables SET status = 'Occupied' WHERE id = $1", [table_id]);
    const tblRes = await client.query(
      `SELECT t.*, f.name as floor_name FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [table_id]
    );

    await client.query('COMMIT');

    const fullOrder = await fetchFullOrder(orderId);
    sse.broadcast('ORDER_CREATED', fullOrder);
    if (tblRes.rows.length > 0) {
      sse.broadcast('TABLE_UPDATED', tblRes.rows[0]);
    }

    res.status(201).json(createdOrder);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Database server error placing order.' });
  } finally {
    client.release();
  }
};

// 2. Edit/Update an Order (SuperAdmin, Admin, Employee)
const editOrder = async (req, res) => {
  const { id } = req.params;
  const { items, table_id, subtotal, tax, discount_amount, total_amount, payment_method, status, notes } = req.body;

  try {
    // Check order details
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    const existingOrder = orderRes.rows[0];

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Role check: Admin/Employee can only edit orders belonging to their shop
    if (req.user.role !== 'SuperAdmin' && existingOrder.shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Order belongs to another shop.' });
    }

    // Paid orders cannot be edited unless user is Admin or SuperAdmin
    if (existingOrder.status === 'Paid' && req.user.role === 'Employee') {
      return res.status(400).json({ error: 'Employees cannot edit paid orders.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update Order Header
      const updateHeaderQuery = `
        UPDATE orders 
        SET table_id = COALESCE($1, table_id),
            subtotal = COALESCE($2, subtotal),
            tax = COALESCE($3, tax),
            discount_amount = COALESCE($4, discount_amount),
            total_amount = COALESCE($5, total_amount),
            payment_method = COALESCE($6, payment_method),
            status = COALESCE($7, status),
            notes = COALESCE($8, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *
      `;
      const headerValues = [
        table_id,
        subtotal,
        tax,
        discount_amount,
        total_amount,
        payment_method,
        status,
        notes,
        id
      ];

      const updatedOrderRes = await client.query(updateHeaderQuery, headerValues);
      const updatedOrder = updatedOrderRes.rows[0];

      // If items array is passed, replace them
      if (items && Array.isArray(items)) {
        // Delete existing items
        await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);

        // Insert new items
        const itemInsertQuery = `
          INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total, fulfilled) 
          VALUES ($1, $2, $3, $4, $5, false)
        `;

        for (const item of items) {
          let uPrice = item.unit_price;
          if (uPrice === undefined) {
            const prodRes = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
            uPrice = prodRes.rows[0]?.price || 0.00;
          }
          const lTotal = item.line_total !== undefined ? item.line_total : (uPrice * item.quantity);

          await client.query(itemInsertQuery, [id, item.product_id, item.quantity, uPrice, lTotal]);
        }
      }

      await client.query('COMMIT');
      const fullOrder = await fetchFullOrder(id);
      sse.broadcast('ORDER_UPDATED', fullOrder);
      res.json(fullOrder);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Edit order error:', err);
    res.status(500).json({ error: 'Database server error updating order.' });
  }
};

// 3. Delete an Order (SuperAdmin Only)
const deleteOrder = async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Forbidden. Only SuperAdmin can delete orders.' });
  }

  try {
    const orderRes = await pool.query('SELECT id, table_id FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM orders WHERE id = $1', [id]);
      
      if (order.table_id) {
        await client.query("UPDATE tables SET status = 'Available' WHERE id = $1", [order.table_id]);
        const tblRes = await client.query(
          `SELECT t.*, f.name as floor_name FROM tables t 
           JOIN floors f ON t.floor_id = f.id 
           WHERE t.id = $1`,
          [order.table_id]
        );
        if (tblRes.rows.length > 0) {
          sse.broadcast('TABLE_UPDATED', tblRes.rows[0]);
        }
      }
      
      await client.query('COMMIT');
      sse.broadcast('ORDER_DELETED', { id });
      res.json({ message: 'Order has been deleted successfully.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 4. List All Orders
const listOrders = async (req, res) => {
  const { shopId } = req.query;

  try {
    let result;
    // Determine scope
    if (req.user.role === 'SuperAdmin') {
      if (shopId) {
        result = await pool.query(
          `SELECT o.*, t.table_number FROM orders o 
           LEFT JOIN tables t ON o.table_id = t.id 
           WHERE o.shop_id = $1 ORDER BY o.created_at DESC`,
          [shopId]
        );
      } else {
        result = await pool.query(
          `SELECT o.*, t.table_number FROM orders o 
           LEFT JOIN tables t ON o.table_id = t.id 
           ORDER BY o.created_at DESC`
        );
      }
    } else {
      // Admins, Employees, Chefs can only list their own shop's orders
      result = await pool.query(
        `SELECT o.*, t.table_number FROM orders o 
         LEFT JOIN tables t ON o.table_id = t.id 
         WHERE o.shop_id = $1 ORDER BY o.created_at DESC`,
        [req.user.shop_id]
      );
    }

    const ordersList = [];
    for (const order of result.rows) {
      // Fetch items for each order
      const itemsRes = await pool.query(
        `SELECT oi.quantity, oi.unit_price, oi.line_total, oi.fulfilled, 
                p.id as product_id, p.name as product_name, p.price as product_price, p.category_id as product_category 
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [order.id]
      );

      // Reformat items to match frontend schema
      const items = itemsRes.rows.map(row => ({
        product: {
          id: row.product_id,
          name: row.product_name,
          price: parseFloat(row.product_price),
          category: row.product_category
        },
        quantity: row.quantity,
        fulfilled: row.fulfilled
      }));

      ordersList.push({
        id: order.id,
        ticketNumber: order.order_number,
        items,
        status: order.kds_status, // map PostgreSQL kds_status to frontend order status
        orderStatus: order.status, // Draft, Paid, Cancelled
        createdAt: order.created_at,
        total: parseFloat(order.total_amount),
        customer: order.customer_name || 'Guest',
        discount: parseFloat(order.discount_amount),
        notes: order.notes,
        tableNumber: order.table_number ? parseInt(order.table_number) : undefined
      });
    }

    res.json(ordersList);
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 5. Update Order KDS Status (Chef or Cashier)
const updateKdsStatus = async (req, res) => {
  const { id } = req.params;
  const { kds_status } = req.body; // 'To Cook', 'Preparing', 'Completed'

  if (!['To Cook', 'Preparing', 'Completed'].includes(kds_status)) {
    return res.status(400).json({ error: 'Invalid KDS stage.' });
  }

  try {
    const orderRes = await pool.query('SELECT shop_id FROM orders WHERE id = $1', [id]);
    const order = orderRes.rows[0];

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Shop restriction
    if (req.user.role !== 'SuperAdmin' && order.shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Order belongs to another shop.' });
    }

    await pool.query('UPDATE orders SET kds_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [kds_status, id]);
    const fullOrder = await fetchFullOrder(id);
    sse.broadcast('ORDER_UPDATED', fullOrder);
    res.json({ message: `Order KDS status updated to ${kds_status}`, order: fullOrder });
  } catch (err) {
    console.error('Update KDS status error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 6. Toggle Item Fulfillment status (Chef only)
const toggleItemFulfillment = async (req, res) => {
  const { orderId, productId } = req.params;

  try {
    const orderRes = await pool.query('SELECT shop_id FROM orders WHERE id = $1', [orderId]);
    const order = orderRes.rows[0];

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (req.user.role !== 'SuperAdmin' && order.shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const currentItemRes = await pool.query(
      'SELECT fulfilled FROM order_items WHERE order_id = $1 AND product_id = $2',
      [orderId, productId]
    );

    if (currentItemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order item not found.' });
    }

    const nextState = !currentItemRes.rows[0].fulfilled;
    await pool.query(
      'UPDATE order_items SET fulfilled = $1 WHERE order_id = $2 AND product_id = $3',
      [nextState, orderId, productId]
    );

    const fullOrder = await fetchFullOrder(orderId);
    sse.broadcast('ORDER_UPDATED', fullOrder);
    res.json({ message: `Item fulfillment set to ${nextState}`, order: fullOrder });
  } catch (err) {
    console.error('Toggle item fulfillment error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

const fetchFullOrder = async (orderId) => {
  const orderRes = await pool.query(
    `SELECT o.*, t.table_number FROM orders o 
     LEFT JOIN tables t ON o.table_id = t.id 
     WHERE o.id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) return null;
  const order = orderRes.rows[0];
  
  const itemsRes = await pool.query(
    `SELECT oi.quantity, oi.unit_price, oi.line_total, oi.fulfilled, 
            p.id as product_id, p.name as product_name, p.price as product_price, p.category_id as product_category 
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [order.id]
  );

  const items = itemsRes.rows.map(row => ({
    product: {
      id: row.product_id,
      name: row.product_name,
      price: parseFloat(row.product_price),
      category: row.product_category
    },
    quantity: row.quantity,
    fulfilled: row.fulfilled
  }));

  return {
    id: order.id,
    ticketNumber: order.order_number,
    items,
    status: order.kds_status, // map PostgreSQL kds_status to frontend order status
    orderStatus: order.status, // Draft, Paid, Cancelled
    createdAt: order.created_at,
    total: parseFloat(order.total_amount),
    customer: order.customer_name || 'Guest',
    discount: parseFloat(order.discount_amount),
    notes: order.notes,
    tableNumber: order.table_number ? parseInt(order.table_number) : undefined
  };
};

module.exports = {
  createOrder,
  editOrder,
  deleteOrder,
  listOrders,
  updateKdsStatus,
  toggleItemFulfillment,
  fetchFullOrder
};
