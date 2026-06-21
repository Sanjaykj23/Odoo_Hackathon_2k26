const pool = require('../../db');
const sse = require('../middleware/sse');
const socketUtil = require('../config/socket');

// Helper to generate a ticket number if not provided
const generateTicketNumber = () => {
  return `T-${Math.floor(100 + Math.random() * 900)}`;
};

// Helper to fetch and format a complete order structure
const getFormattedOrder = async (orderId) => {
  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) return null;

  const itemsRes = await pool.query(
    `SELECT oi.quantity, oi.unit_price, oi.line_total, oi.fulfilled, 
            p.id as product_id, p.name as product_name, p.price as product_price, p.category_id as product_category 
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [orderId]
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
    status: order.kds_status,
    orderStatus: order.status,
    createdAt: order.created_at,
    total: parseFloat(order.total_amount),
    customer: order.customer_name || 'Guest',
    discount: parseFloat(order.discount_amount),
    notes: order.notes
  };
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
        subtotal, tax, discount_amount, total_amount, payment_method, status, kds_status, notes, customer_name, guest_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'To Cook', $14, $15, $16)
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
      customer_name || null,
      req.body.guest_count || 1
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

    // Update table status in database and fetch table details
    let tblRes = { rows: [] };
    if (table_id) {
      const tableIds = table_id.split(',');
      const guestCount = req.body.guest_count || 1;
      
      const capRes = await client.query('SELECT SUM(seats) as total_cap FROM tables WHERE id = ANY($1)', [tableIds]);
      const totalCap = parseInt(capRes.rows[0].total_cap) || 4;
      
      const newStatus = guestCount < totalCap ? 'Partially Occupied' : 'Occupied';
      
      // Update status
      await client.query("UPDATE tables SET status = $1 WHERE id = ANY($2)", [newStatus, tableIds]);
      
      tblRes = await client.query(
        `SELECT t.*, f.name as floor_name FROM tables t 
         JOIN floors f ON t.floor_id = f.id 
         WHERE t.id = ANY($1)`,
        [tableIds]
      );
    }

    await client.query('COMMIT');

    // Broadcast SSE updates
    const fullOrder = await fetchFullOrder(orderId);
    sse.broadcast('ORDER_CREATED', fullOrder);
    if (tblRes.rows.length > 0) {
      sse.broadcast('TABLE_UPDATED', tblRes.rows[0]);
    }

    // Fetch formatted order for broadcast
    const formattedOrder = await getFormattedOrder(orderId);

    // Broadcast WebSocket updates
    try {
      const io = socketUtil.getIO();
      io.to(`branch_${targetShopId}_kitchen`).emit('NEW_KITCHEN_TICKET', formattedOrder);
      io.to(`branch_${targetShopId}_all`).emit('TABLES_UPDATED', {
        tableIds: table_id ? table_id.split(',') : [],
        status: 'Occupied'
      });
    } catch (wsErr) {
      console.error('Socket broadcast error in createOrder:', wsErr.message);
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

      // Check if status has transitioned to 'Paid' (Checkout)
      if (status === 'Paid') {
        const orderTableId = table_id || existingOrder.table_id;
        if (orderTableId) {
          const tableIds = orderTableId.split(',');
          await pool.query("UPDATE tables SET status = 'Available' WHERE id = ANY($1)", [tableIds]);
        }

        // Broadcast PAYMENT_SUCCESSFUL to customer display and TABLES_UPDATED to all
        try {
          const io = socketUtil.getIO();
          const targetShopId = existingOrder.shop_id;
          io.to(`branch_${targetShopId}_customer`).emit('PAYMENT_SUCCESSFUL', { orderId: id });
          io.to(`branch_${targetShopId}_all`).emit('TABLES_UPDATED', {
            tableIds: orderTableId ? [orderTableId] : [],
            status: 'Available'
          });
        } catch (wsErr) {
          console.error('Socket broadcast error in editOrder checkout:', wsErr.message);
        }
      }

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
        const tableIds = order.table_id.split(',');
        await client.query("UPDATE tables SET status = 'Available' WHERE id = ANY($1)", [tableIds]);
        const tblRes = await client.query(
          `SELECT t.*, f.name as floor_name FROM tables t 
           JOIN floors f ON t.floor_id = f.id 
           WHERE t.id = ANY($1)`,
          [tableIds]
        );
        const io = socketUtil.getIO();
        io.to(`branch_${req.user.shop_id}_all`).emit('TABLES_UPDATED', {
          tableIds,
          status: 'Available'
        });
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
          `SELECT o.*, (SELECT string_agg(t.table_number::text, ', ') FROM tables t WHERE t.id::text = ANY(string_to_array(o.table_id, ','))) as table_number FROM orders o 
           WHERE o.shop_id = $1 ORDER BY o.created_at DESC`,
          [shopId]
        );
      } else {
        result = await pool.query(
          `SELECT o.*, (SELECT string_agg(t.table_number::text, ', ') FROM tables t WHERE t.id::text = ANY(string_to_array(o.table_id, ','))) as table_number FROM orders o 
           ORDER BY o.created_at DESC`
        );
      }
    } else {
      // Admins, Employees, Chefs can only list their own shop's orders
      result = await pool.query(
        `SELECT o.*, (SELECT string_agg(t.table_number::text, ', ') FROM tables t WHERE t.id::text = ANY(string_to_array(o.table_id, ','))) as table_number FROM orders o 
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
        tableNumber: order.table_number ? parseInt(order.table_number) : undefined,
        shop_id: order.shop_id
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
    const orderRes = await pool.query('SELECT shop_id, customer_id FROM orders WHERE id = $1', [id]);
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

    // Broadcast WebSocket updates and Thank You message
    try {
      const io = socketUtil.getIO();
      const targetShopId = order.shop_id;
      if (kds_status === 'Completed') {
        io.to(`branch_${targetShopId}_pos`).emit('ORDER_READY_TO_SERVE', { orderId: id, status: 'Completed' });
        io.to(`branch_${targetShopId}_customer`).emit('ORDER_READY_TO_SERVE', { orderId: id, status: 'Completed' });

        // Send Thank You WhatsApp message
        if (order.customer_id) {
          const custRes = await pool.query('SELECT phone_number FROM customers WHERE id = $1', [order.customer_id]);
          const shopRes = await pool.query('SELECT name FROM shops WHERE id = $1', [order.shop_id]);
          const phone = custRes.rows[0]?.phone_number;
          const shopName = shopRes.rows[0]?.name;

          if (phone) {
            const ticketService = require('../services/ticketService');
            ticketService.sendThankYouWhatsApp(phone, shopName);
          }
        }

      } else {
        io.to(`branch_${targetShopId}_pos`).emit('ORDER_STATUS_UPDATE', { orderId: id, status: kds_status });
        io.to(`branch_${targetShopId}_customer`).emit('ORDER_STATUS_UPDATE', { orderId: id, status: kds_status });
      }
    } catch (wsErr) {
      console.error('Socket/WhatsApp broadcast error in updateKdsStatus:', wsErr.message);
    }

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

    // Broadcast WebSocket updates
    try {
      const io = socketUtil.getIO();
      const targetShopId = order.shop_id;
      io.to(`branch_${targetShopId}_pos`).emit('ITEM_COOKED', {
        orderId,
        productId,
        status: nextState ? 'ready' : 'pending'
      });
    } catch (wsErr) {
      console.error('Socket broadcast error in toggleItemFulfillment:', wsErr.message);
    }

    res.json({ message: `Item fulfillment set to ${nextState}`, order: fullOrder });
  } catch (err) {
    console.error('Toggle item fulfillment error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

const fetchFullOrder = async (orderId) => {
  const orderRes = await pool.query(
    `SELECT o.*, (SELECT string_agg(t.table_number::text, ', ') FROM tables t WHERE t.id::text = ANY(string_to_array(o.table_id, ','))) as table_number FROM orders o 
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
