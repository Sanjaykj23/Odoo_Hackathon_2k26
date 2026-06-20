const express = require('express');
const router = express.Router();
const pool = require('../../db');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const orderController = require('../controllers/orderController');
const sse = require('../middleware/sse');
const reportController = require('../controllers/reportController');
<<<<<<< HEAD
const paymentController = require('../controllers/paymentController');

=======
const analyticsController = require('../controllers/analyticsController');
const shiftController = require('../controllers/shiftController');
>>>>>>> ff227929a91111fd3e83001011bb6efa4634d10e

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
  const { name, address, phone, table_capacities } = req.body;
  if (!name) return res.status(400).json({ error: 'Shop name is required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const newShop = await client.query(
      'INSERT INTO shops (name, address, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, address, phone]
    );
    const shop = newShop.rows[0];

    // Create a default floor for this shop
    const defaultFloor = await client.query(
      "INSERT INTO floors (shop_id, name) VALUES ($1, 'Main Floor') RETURNING id",
      [shop.id]
    );
    const floorId = defaultFloor.rows[0].id;

    // Create tables if capacities are provided
    if (Array.isArray(table_capacities) && table_capacities.length > 0) {
      const crypto = require('crypto');
      for (let i = 0; i < table_capacities.length; i++) {
        const tableNum = i + 1;
        const seats = parseInt(table_capacities[i]) || 2;
        const tableId = `tbl-${shop.id}-${tableNum}`;
        const qrToken = `token_${shop.id}_${tableNum}_${crypto.randomBytes(4).toString('hex')}`;

        await client.query(
          `INSERT INTO tables (id, floor_id, table_number, seats, status, qr_token)
           VALUES ($1, $2, $3, $4, 'Available', $5)`,
          [tableId, floorId, tableNum, seats, qrToken]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(shop);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
      `INSERT INTO categories (id, shop_id, name, color) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (id) DO UPDATE 
       SET name = EXCLUDED.name, color = EXCLUDED.color
       RETURNING *`,
      [id, targetShopId, name, color || '#714B67']
    );
    sse.broadcast('CATEGORY_UPDATED', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Category Color/Name
router.put('/categories/:id', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id } = req.params;
  const { name, color, is_active } = req.body;

  try {
    const checkRes = await pool.query('SELECT shop_id FROM categories WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Category not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Category belongs to another shop.' });
    }

    const result = await pool.query(
      `UPDATE categories 
       SET name = COALESCE($1, name), 
           color = COALESCE($2, color),
           is_active = COALESCE($3, is_active)
       WHERE id = $4 
       RETURNING *`,
      [name, color, is_active, id]
    );

    sse.broadcast('CATEGORY_UPDATED', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Category
router.delete('/categories/:id', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await pool.query('SELECT shop_id FROM categories WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Category not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Category belongs to another shop.' });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    sse.broadcast('CATEGORY_DELETED', { id });
    res.json({ message: 'Category deleted successfully.' });
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
  const { id, name, category_id, price, uom, tax, description, image_url, shop_id, popularity, cost_index, country } = req.body;
  if (!id || !name || !price) return res.status(400).json({ error: 'Product ID, Name, and Price are required.' });

  const targetShopId = req.user.role === 'Admin' ? req.user.shop_id : shop_id;
  if (!targetShopId) return res.status(400).json({ error: 'shop_id is required.' });

  try {
    const result = await pool.query(
      `INSERT INTO products (
         id, shop_id, category_id, name, price, uom, tax, description, image_url, is_available, 
         popularity, cost_index, country
       ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12) 
       ON CONFLICT (id) DO UPDATE 
       SET name = EXCLUDED.name, category_id = EXCLUDED.category_id, price = EXCLUDED.price, 
           uom = EXCLUDED.uom, tax = EXCLUDED.tax, description = EXCLUDED.description, image_url = EXCLUDED.image_url,
           popularity = EXCLUDED.popularity, cost_index = EXCLUDED.cost_index, country = EXCLUDED.country
       RETURNING *`,
      [
        id, targetShopId, category_id, name, price, uom || 'per piece', tax || 5.00, description, image_url,
        popularity !== undefined ? parseInt(popularity) : 4,
        cost_index !== undefined ? parseInt(cost_index) : 2,
        country || 'India'
      ]
    );
    sse.broadcast('PRODUCT_UPDATED', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Product Availability
router.put('/products/:id/availability', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id } = req.params;
  const { is_available } = req.body;

  try {
    const checkRes = await pool.query('SELECT shop_id FROM products WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Product belongs to another shop.' });
    }

    const result = await pool.query(
      'UPDATE products SET is_available = $1 WHERE id = $2 RETURNING *',
      [is_available, id]
    );

    sse.broadcast('PRODUCT_UPDATED', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Product
router.delete('/products/:id', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await pool.query('SELECT shop_id FROM products WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Product belongs to another shop.' });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    sse.broadcast('PRODUCT_DELETED', { id });
    res.json({ message: 'Product deleted successfully.' });
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

// Create Floor
router.post('/floors', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { name, shop_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Floor name is required.' });

  const targetShopId = req.user.role === 'Admin' ? req.user.shop_id : shop_id;
  if (!targetShopId) return res.status(400).json({ error: 'shop_id is required.' });

  try {
    const result = await pool.query(
      'INSERT INTO floors (shop_id, name) VALUES ($1, $2) RETURNING *',
      [targetShopId, name]
    );
    sse.broadcast('FLOOR_UPDATED', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Floor
router.delete('/floors/:id', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await pool.query('SELECT shop_id FROM floors WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Floor not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Floor belongs to another shop.' });
    }

    await pool.query('DELETE FROM floors WHERE id = $1', [id]);
    sse.broadcast('FLOOR_DELETED', { id: parseInt(id) });
    res.json({ message: 'Floor deleted successfully.' });
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

// Create Table
router.post('/tables', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id, floor_id, table_number, seats, status, qr_token } = req.body;
  if (!id || !floor_id || !table_number) {
    return res.status(400).json({ error: 'id, floor_id, and table_number are required.' });
  }

  try {
    // Verify floor shop
    const floorCheck = await pool.query('SELECT shop_id FROM floors WHERE id = $1', [floor_id]);
    if (floorCheck.rows.length === 0) return res.status(404).json({ error: 'Floor not found.' });
    if (req.user.role !== 'SuperAdmin' && floorCheck.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Floor belongs to another shop.' });
    }

    const tokenVal = qr_token || `token_${id}_${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO tables (id, floor_id, table_number, seats, status, qr_token) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (id) DO UPDATE 
       SET floor_id = EXCLUDED.floor_id, table_number = EXCLUDED.table_number, 
           seats = EXCLUDED.seats, status = EXCLUDED.status, qr_token = EXCLUDED.qr_token
       RETURNING *`,
      [id, floor_id, table_number, seats || 2, status || 'Available', tokenVal]
    );

    const tableWithFloor = await pool.query(
      `SELECT t.*, f.name as floor_name FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [id]
    );
    sse.broadcast('TABLE_UPDATED', tableWithFloor.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Table
router.delete('/tables/:id', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const checkRes = await pool.query(
      `SELECT f.shop_id FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Table not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Table belongs to another shop.' });
    }

    await pool.query('DELETE FROM tables WHERE id = $1', [id]);
    sse.broadcast('TABLE_DELETED', { id });
    res.json({ message: 'Table deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/tables/:id/status', auth.verifyToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Available', 'Occupied', 'Reserved', 'Maintenance'].includes(status)) {
    return res.status(400).json({ error: 'Invalid table status.' });
  }

  try {
    const checkRes = await pool.query(
      `SELECT f.shop_id FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Table not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Table belongs to another shop.' });
    }

    const result = await pool.query('UPDATE tables SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    const tableWithFloor = await pool.query(
      `SELECT t.*, f.name as floor_name FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [id]
    );
    sse.broadcast('TABLE_UPDATED', tableWithFloor.rows[0]);
    res.json({ message: 'Table status updated successfully.', table: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit Table Capacity (SuperAdmin and Admin)
router.put('/tables/:id/capacity', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { id } = req.params;
  const { capacity } = req.body;
  
  if (capacity === undefined || isNaN(parseInt(capacity))) {
    return res.status(400).json({ error: 'Valid capacity is required.' });
  }

  try {
    const checkRes = await pool.query(
      `SELECT f.shop_id FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [id]
    );
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Table not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. Table belongs to another shop.' });
    }

    const result = await pool.query(
      'UPDATE tables SET seats = $1 WHERE id = $2 RETURNING *',
      [parseInt(capacity), id]
    );

    const tableWithFloor = await pool.query(
      `SELECT t.*, f.name as floor_name FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [id]
    );
    sse.broadcast('TABLE_UPDATED', tableWithFloor.rows[0]);
    res.json({ message: 'Table capacity updated successfully.', table: result.rows[0] });
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

// Create Promotion
router.post('/promos', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { code, discountType, value, shop_id } = req.body;
  if (!code || !discountType || value === undefined) {
    return res.status(400).json({ error: 'code, discountType, and value are required.' });
  }

  const targetShopId = req.user.role === 'Admin' ? req.user.shop_id : shop_id;
  if (!targetShopId) return res.status(400).json({ error: 'shop_id is required.' });

  try {
    const result = await pool.query(
      `INSERT INTO coupons_promotions (shop_id, type, code, discount_type, discount_value, is_active) 
       VALUES ($1, 'Coupon', $2, $3, $4, true) 
       ON CONFLICT (code) DO UPDATE 
       SET discount_type = EXCLUDED.discount_type, discount_value = EXCLUDED.discount_value
       RETURNING *`,
      [targetShopId, code.trim().toUpperCase(), discountType, value]
    );

    sse.broadcast('PROMO_UPDATED', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update/Toggle Promotion
router.put('/promos/:code', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { code } = req.params;
  const { active, discountType, value } = req.body;

  try {
    const checkRes = await pool.query('SELECT shop_id FROM coupons_promotions WHERE code = $1', [code]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Promotion not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const result = await pool.query(
      `UPDATE coupons_promotions 
       SET is_active = COALESCE($1, is_active),
           discount_type = COALESCE($2, discount_type),
           discount_value = COALESCE($3, discount_value)
       WHERE code = $4 
       RETURNING *`,
      [active, discountType, value, code]
    );

    sse.broadcast('PROMO_UPDATED', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Promotion
router.delete('/promos/:code', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), async (req, res) => {
  const { code } = req.params;

  try {
    const checkRes = await pool.query('SELECT shop_id FROM coupons_promotions WHERE code = $1', [code]);
    if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Promotion not found.' });
    if (req.user.role !== 'SuperAdmin' && checkRes.rows[0].shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    await pool.query('DELETE FROM coupons_promotions WHERE code = $1', [code]);
    sse.broadcast('PROMO_DELETED', { code });
    res.json({ message: 'Promotion deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. PAYMENT PROCESSING
// ==========================================
router.post('/orders/:id/pay', auth.verifyToken, async (req, res) => {
  const { id } = req.params;
  const { payment_method, transaction_ref, amount } = req.body;

  if (!payment_method) {
    return res.status(400).json({ error: 'payment_method is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];

    if (req.user.role !== 'SuperAdmin' && order.shop_id !== req.user.shop_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden. Order belongs to another shop.' });
    }

    const payAmount = amount !== undefined ? parseFloat(amount) : parseFloat(order.total_amount);

    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, transaction_ref, status) 
       VALUES ($1, $2, $3, $4, 'Success')`,
      [id, payAmount, payment_method, transaction_ref || null]
    );

    const updatedOrderRes = await client.query(
      `UPDATE orders 
       SET status = 'Paid', payment_method = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [payment_method, id]
    );
    const updatedOrder = updatedOrderRes.rows[0];

    if (order.table_id) {
      await client.query("UPDATE tables SET status = 'Available' WHERE id = $1", [order.table_id]);
      const tableRes = await client.query(
        `SELECT t.*, f.name as floor_name FROM tables t 
         JOIN floors f ON t.floor_id = f.id 
         WHERE t.id = $1`,
        [order.table_id]
      );
      if (tableRes.rows.length > 0) {
        sse.broadcast('TABLE_UPDATED', tableRes.rows[0]);
      }
    }

    await client.query('COMMIT');
    // Broadcast the fully joined order with items + tableNumber
    const fullOrderData = await orderController.fetchFullOrder(id);
    sse.broadcast('ORDER_UPDATED', fullOrderData || updatedOrder);
    res.json({ message: 'Order paid successfully.', order: updatedOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during checkout pay:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 9. PUBLIC CUSTOMER SELF-ORDERING ROUTES
// ==========================================
router.get('/public/table/:qrToken', async (req, res) => {
  const { qrToken } = req.params;

  try {
    // Try by qr_token first, then fall back to table id (for legacy/test URLs)
    let tableRes = await pool.query(
      `SELECT t.*, f.name as floor_name, f.shop_id, s.name as shop_name, s.address as shop_address 
       FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       JOIN shops s ON f.shop_id = s.id 
       WHERE t.qr_token = $1`,
      [qrToken]
    );

    // Fallback: try matching by table id
    if (tableRes.rows.length === 0) {
      tableRes = await pool.query(
        `SELECT t.*, f.name as floor_name, f.shop_id, s.name as shop_name, s.address as shop_address 
         FROM tables t 
         JOIN floors f ON t.floor_id = f.id 
         JOIN shops s ON f.shop_id = s.id 
         WHERE t.id = $1`,
        [qrToken]
      );
    }

    if (tableRes.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found. Please scan the QR code again.' });
    }
    const tableInfo = tableRes.rows[0];

    const [categoriesRes, productsRes, promosRes] = await Promise.all([
      pool.query('SELECT * FROM categories WHERE shop_id = $1 AND is_active = true ORDER BY name', [tableInfo.shop_id]),
      pool.query('SELECT * FROM products WHERE shop_id = $1 AND is_available = true ORDER BY name', [tableInfo.shop_id]),
      pool.query('SELECT * FROM coupons_promotions WHERE shop_id = $1 AND is_active = true ORDER BY code', [tableInfo.shop_id])
    ]);

    res.json({
      table: {
        id: tableInfo.id,
        number: tableInfo.table_number,
        seats: tableInfo.seats,
        status: tableInfo.status,
        qr_token: tableInfo.qr_token
      },
      floor: {
        id: tableInfo.floor_id,
        name: tableInfo.floor_name
      },
      shop: {
        id: tableInfo.shop_id,
        name: tableInfo.shop_name,
        address: tableInfo.shop_address
      },
      categories: categoriesRes.rows,
      products: productsRes.rows,
      promos: promosRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/public/orders', async (req, res) => {
  const {
    qr_token,
    table_id,
    items,
    subtotal,
    tax,
    discount_amount,
    total_amount,
    notes,
    customer_name,
    guest_count
  } = req.body;

  if (!qr_token || !table_id || !items || items.length === 0) {
    return res.status(400).json({ error: 'qr_token, table_id, and items are required.' });
  }

  const tableCheck = await pool.query(
    `SELECT t.id, f.shop_id, t.table_number FROM tables t 
     JOIN floors f ON t.floor_id = f.id 
     WHERE t.id = $1 AND t.qr_token = $2`,
    [table_id, qr_token]
  );
  if (tableCheck.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid table ID or QR token.' });
  }
  const { shop_id, table_number } = tableCheck.rows[0];

  const orderId = `o-${Date.now()}`;
  const orderNum = `T-${Math.floor(100 + Math.random() * 900)}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderQuery = `
      INSERT INTO orders (
        id, order_number, shop_id, session_id, employee_id, customer_id, table_id, 
        subtotal, tax, discount_amount, total_amount, payment_method, status, kds_status, notes, customer_name, guest_count
      ) VALUES ($1, $2, $3, null, null, null, $4, $5, $6, $7, $8, null, 'Draft', 'To Cook', $9, $10, $11)
      RETURNING *
    `;
    const orderRes = await client.query(orderQuery, [
      orderId, orderNum, shop_id, table_id,
      subtotal || 0.00, tax || 0.00, discount_amount || 0.00, total_amount || 0.00, 
      notes || null, customer_name || 'Table Guest', guest_count || 1
    ]);
    const createdOrder = orderRes.rows[0];

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

    await client.query("UPDATE tables SET status = 'Occupied' WHERE id = $1", [table_id]);
    const updatedTableRes = await client.query(
      `SELECT t.*, f.name as floor_name FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [table_id]
    );
    
    await client.query('COMMIT');

    // Broadcast the fully joined order with items + tableNumber for KDS
    const fullOrder = await orderController.fetchFullOrder(orderId);
    sse.broadcast('ORDER_CREATED', fullOrder);
    sse.broadcast('TABLE_UPDATED', updatedTableRes.rows[0]);

    res.status(201).json(createdOrder);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error placing public self-order:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

<<<<<<< HEAD
// Reserve Table Endpoint
router.post('/public/tables/:qr_token/reserve', async (req, res) => {
  const { qr_token } = req.params;
  const { guest_count, customer_name, phone, email } = req.body;

  if (!guest_count || isNaN(parseInt(guest_count))) {
    return res.status(400).json({ error: 'Valid guest count is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find table details
    const tableRes = await client.query(
      `SELECT t.*, f.name as floor_name, f.shop_id 
       FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.qr_token = $1 OR t.id = $1`,
      [qr_token]
    );

    if (tableRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid QR token or table not found.' });
    }

    const table = tableRes.rows[0];

    // Check capacity
    if (parseInt(guest_count) > table.seats) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Requested seats (${guest_count}) exceeds table capacity (${table.seats}). Please contact a waiter.` 
      });
    }

    // Insert or find customer
    let customerId = null;
    if (customer_name) {
      const custRes = await client.query(
        `INSERT INTO customers (name, phone_number, email) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [customer_name, phone || null, email || null]
      );
      customerId = custRes.rows[0].id;
    }

    // Set table status to Occupied
    const updatedTable = await client.query(
      "UPDATE tables SET status = 'Occupied' WHERE id = $1 RETURNING *",
      [table.id]
    );

    await client.query('COMMIT');

    const tableWithFloor = {
      ...updatedTable.rows[0],
      floor_name: table.floor_name,
      shop_id: table.shop_id
    };

    // Broadcast change
    sse.broadcast('TABLE_UPDATED', tableWithFloor);

    res.json({
      message: 'Reservation successful.',
      table: tableWithFloor,
      customerId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// End Session Endpoint (Public)
router.post('/public/tables/:table_id/end-session', async (req, res) => {
  const { table_id } = req.params;
  const client = await pool.connect();
  try {
    // Find table by either id or qr_token
    const tableRes = await client.query(
      `SELECT * FROM tables WHERE id = $1 OR qr_token = $1`,
      [table_id]
    );
    if (tableRes.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found.' });
    }
    const table = tableRes.rows[0];

    // Set table status back to Available
    const updatedTable = await client.query(
      "UPDATE tables SET status = 'Available' WHERE id = $1 RETURNING *",
      [table.id]
    );

    // Broadcast change
    const tableWithFloorRes = await client.query(
      `SELECT t.*, f.name as floor_name FROM tables t JOIN floors f ON t.floor_id = f.id WHERE t.id = $1`,
      [table.id]
    );
    if (tableWithFloorRes.rows.length > 0) {
      sse.broadcast('TABLE_UPDATED', tableWithFloorRes.rows[0]);
    }

    res.json({ message: 'Session ended successfully.', table: updatedTable.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Table Order History Endpoint
router.get('/public/tables/:table_id/history', async (req, res) => {
  const { table_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT o.*, 
              COALESCE(
                json_agg(
                  json_build_object(
                    'product_id', oi.product_id,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'line_total', oi.line_total,
                    'product_name', p.name
                  )
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.table_id = $1 
         AND o.created_at >= CURRENT_DATE 
         AND o.status != 'Cancelled'
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [table_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Razorpay Payments
router.post('/payments/razorpay/order', paymentController.createRazorpayOrder);
router.post('/payments/razorpay/verify', paymentController.verifyPayment);

// COD Checkout Endpoint
router.post('/public/orders/:id/checkout/cod', async (req, res) => {
  const { id } = req.params;
  const { phone } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch order details
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];

    // Create customer entry if phone supplied
    if (phone && !order.customer_id) {
      const custRes = await client.query(
        "INSERT INTO customers (name, phone_number) VALUES ($1, $2) RETURNING id",
        [order.customer_name || 'Table Guest', phone]
      );
      await client.query("UPDATE orders SET customer_id = $1 WHERE id = $2", [custRes.rows[0].id, id]);
    }

    // Update order status to 'To Pay' and payment_method to 'Cash'
    const updatedOrderRes = await client.query(
      `UPDATE orders 
       SET status = 'To Pay', payment_method = 'Cash', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    const updatedOrder = updatedOrderRes.rows[0];

    await client.query("UPDATE tables SET status = 'Occupied' WHERE id = $1", [order.table_id]);
    const tableRes = await client.query(
      `SELECT t.*, f.name as floor_name FROM tables t 
       JOIN floors f ON t.floor_id = f.id 
       WHERE t.id = $1`,
      [order.table_id]
    );

    await client.query('COMMIT');

    // Broadcast table and order changes
    if (tableRes.rows.length > 0) {
      sse.broadcast('TABLE_UPDATED', tableRes.rows[0]);
    }
    const fullOrder = await orderController.fetchFullOrder(id);
    sse.broadcast('ORDER_UPDATED', fullOrder);

    // Trigger WhatsApp notification asynchronously
    const whatsappService = require('../services/whatsappService');
    whatsappService.sendOrderConfirmation(id).catch(err => {
      console.error('Error sending WhatsApp order confirmation:', err);
    });

    res.json({ message: 'COD checkout initiated. Please pay cash to server.', order: updatedOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 10. ANALYTICS & REPORTS
// ==========================================
=======
>>>>>>> ff227929a91111fd3e83001011bb6efa4634d10e
router.get('/reports', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin']), reportController.getReports);

// Analytics endpoints
router.get('/analytics/branch', auth.verifyToken, auth.requireRole(['SuperAdmin', 'Admin', 'Employee']), analyticsController.getBranchAnalytics);
router.get('/analytics/super', auth.verifyToken, auth.requireRole(['SuperAdmin']), analyticsController.getSuperAnalytics);

// Shift reconciliation endpoints
router.get('/shifts/previous-summary', auth.verifyToken, shiftController.getPreviousSummary);
router.get('/shifts/current-summary', auth.verifyToken, shiftController.getCurrentSummary);

module.exports = router;
