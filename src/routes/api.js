const express = require('express');
const router = express.Router();
const pool = require('../../db');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const orderController = require('../controllers/orderController');

// ==========================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ==========================================
router.post('/auth/login', authController.login);
router.post('/auth/create-admin', auth.verifyToken, auth.requireRole(['SuperAdmin']), authController.createAdmin);
router.post('/auth/create-employee', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), authController.createEmployee);
router.get('/auth/employees', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), authController.listUsers);
router.put('/auth/employees/:id/archive', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), authController.toggleArchiveUser);
router.delete('/auth/employees/:id', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), authController.deleteUser);
router.put('/auth/employees/:id/password', auth.verifyToken, authController.changePassword);

// ==========================================
// 2. SHOP MANAGEMENT
// ==========================================
// List all shops (SuperAdmin sees all, Admins/Employees see their own shop)
router.get('/shops', auth.verifyToken, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'SuperAdmin') {
      result = await pool.query('SELECT * FROM shops ORDER BY name');
    } else {
      result = await pool.query('SELECT * FROM shops WHERE id = $1', [req.user.shop_id]);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Shop (SuperAdmin Only)
router.post('/shops', auth.verifyToken, auth.requireRole(['SuperAdmin']), async (req, res) => {
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Shop name is required.' });

  try {
    const newShop = await pool.query(
      'INSERT INTO shops (name, address, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, address, phone]
    );
    res.status(201).json(newShop.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. PRODUCT & CATEGORY MANAGEMENT
// ==========================================
// Get Categories
router.get('/categories', auth.verifyToken, async (req, res) => {
  try {
    const shopId = req.user.role === 'SuperAdmin' ? req.query.shopId : req.user.shop_id;
    let result;
    if (shopId) {
      result = await pool.query('SELECT * FROM categories WHERE shop_id = $1 ORDER BY name', [shopId]);
    } else {
      result = await pool.query('SELECT * FROM categories ORDER BY name');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Category
router.post('/categories', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id, name, color, shop_id } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Category ID and Name are required.' });

  const targetShopId = req.user.role === 'Admin' ? req.user.shop_id : shop_id;
  if (!targetShopId) return res.status(400).json({ error: 'shop_id is required.' });

  try {
    const result = await pool.query(
      'INSERT INTO categories (id, shop_id, name, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, targetShopId, name, color || '#714B67']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Products
router.get('/products', auth.verifyToken, async (req, res) => {
  try {
    const shopId = req.user.role === 'SuperAdmin' ? req.query.shopId : req.user.shop_id;
    let result;
    if (shopId) {
      result = await pool.query('SELECT * FROM products WHERE shop_id = $1 ORDER BY name', [shopId]);
    } else {
      result = await pool.query('SELECT * FROM products ORDER BY name');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update Product
router.post('/products', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id, name, category_id, price, uom, tax, description, image_url, shop_id } = req.body;
  if (!id || !name || !price) return res.status(400).json({ error: 'Product ID, Name, and Price are required.' });

  const targetShopId = req.user.role === 'Admin' ? req.user.shop_id : shop_id;
  if (!targetShopId) return res.status(400).json({ error: 'shop_id is required.' });

  try {
    const result = await pool.query(
      `INSERT INTO products (id, shop_id, category_id, name, price, uom, tax, description, image_url, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) 
       ON CONFLICT (id) DO UPDATE 
       SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, price = EXCLUDED.price, 
           uom = EXCLUDED.uom, tax = EXCLUDED.tax, description = EXCLUDED.description, image_url = EXCLUDED.image_url
       RETURNING *`,
      [id, targetShopId, category_id, name, price, uom || 'per piece', tax || 5.00, description, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. FLOORS & TABLES
// ==========================================
router.get('/floors', auth.verifyToken, async (req, res) => {
  try {
    const shopId = req.user.role === 'SuperAdmin' ? req.query.shopId : req.user.shop_id;
    let result;
    if (shopId) {
      result = await pool.query('SELECT * FROM floors WHERE shop_id = $1 ORDER BY name', [shopId]);
    } else {
      result = await pool.query('SELECT * FROM floors ORDER BY name');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tables', auth.verifyToken, async (req, res) => {
  try {
    const shopId = req.user.role === 'SuperAdmin' ? req.query.shopId : req.user.shop_id;
    let result;
    if (shopId) {
      result = await pool.query(
        `SELECT t.*, f.name as floor_name FROM tables t 
         JOIN floors f ON t.floor_id = f.id 
         WHERE f.shop_id = $1 ORDER BY t.table_number`,
        [shopId]
      );
    } else {
      result = await pool.query(
        `SELECT t.*, f.name as floor_name FROM tables t 
         JOIN floors f ON t.floor_id = f.id ORDER BY t.table_number`
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tables/:id/status', auth.verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Available', 'Occupied', 'Reserved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid table status.' });
  }

  try {
    await pool.query('UPDATE tables SET status = $1 WHERE id = $2', [status, id]);
    res.json({ message: 'Table status updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. SESSION MANAGEMENT
// ==========================================
// Get Sessions
router.get('/sessions', auth.verifyToken, async (req, res) => {
  try {
    const shopId = req.user.role === 'SuperAdmin' ? req.query.shopId : req.user.shop_id;
    let result;
    if (shopId) {
      result = await pool.query(
        `SELECT s.*, u.name as employee_name FROM sessions s 
         LEFT JOIN users u ON s.opened_by_user_id = u.id 
         WHERE s.shop_id = $1 ORDER BY s.opening_date DESC`,
        [shopId]
      );
    } else {
      result = await pool.query(
        `SELECT s.*, u.name as employee_name FROM sessions s 
         LEFT JOIN users u ON s.opened_by_user_id = u.id ORDER BY s.opening_date DESC`
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Open Session
router.post('/sessions/open', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin', 'Employee']), async (req, res) => {
  const shopId = req.user.shop_id;
  if (!shopId) return res.status(400).json({ error: 'User is not assigned to a shop.' });

  try {
    // Check if there is already an open session
    const openRes = await pool.query(
      `SELECT id FROM sessions WHERE shop_id = $1 AND status = 'Open'`,
      [shopId]
    );
    if (openRes.rows.length > 0) {
      return res.status(400).json({ error: 'There is already an active open session for this shop.' });
    }

    const newSession = await pool.query(
      `INSERT INTO sessions (shop_id, opened_by_user_id, status) VALUES ($1, $2, 'Open') RETURNING *`,
      [shopId, req.user.id]
    );

    res.status(201).json(newSession.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close Session
router.post('/sessions/:id/close', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin', 'Employee']), async (req, res) => {
  const { id } = req.params;
  const { closing_amount } = req.body;

  try {
    // Calculate final closing sales amount for this session from database orders
    const totalSalesRes = await pool.query(
      `SELECT SUM(total_amount) as total FROM orders WHERE session_id = $1 AND status = 'Paid'`,
      [id]
    );
    const calculatedSales = parseFloat(totalSalesRes.rows[0]?.total || 0.00);
    const finalAmount = closing_amount !== undefined ? closing_amount : calculatedSales;

    const result = await pool.query(
      `UPDATE sessions 
       SET status = 'Closed', 
           closing_date = CURRENT_TIMESTAMP, 
           closing_sale_amount = $1 
       WHERE id = $2 AND status = 'Open' 
       RETURNING *`,
      [finalAmount, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active open session not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. ORDERING & BILLING
// ==========================================
router.get('/orders', auth.verifyToken, orderController.listOrders);
router.post('/orders', auth.verifyToken, orderController.createOrder);
router.put('/orders/:id', auth.verifyToken, orderController.editOrder);
router.delete('/orders/:id', auth.verifyToken, orderController.deleteOrder);
router.put('/orders/:id/kds', auth.verifyToken, orderController.updateKdsStatus);
router.put('/orders/:orderId/items/:productId/fulfill', auth.verifyToken, orderController.toggleItemFulfillment);

// ==========================================
// 7. PROMOTIONS & COUPONS
// ==========================================
router.get('/promos', auth.verifyToken, async (req, res) => {
  try {
    const shopId = req.user.role === 'SuperAdmin' ? req.query.shopId : req.user.shop_id;
    let result;
    if (shopId) {
      result = await pool.query('SELECT * FROM coupons_promotions WHERE shop_id = $1 ORDER BY code', [shopId]);
    } else {
      result = await pool.query('SELECT * FROM coupons_promotions ORDER BY code');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
