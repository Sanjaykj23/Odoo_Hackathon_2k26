const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../../db');
const tokenCache = require('../services/tokenCache');

const JWT_SECRET = process.env.JWT_SECRET || 'odoocafesupersecretkey12345!';

// 1. User Login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is archived and inactive. Contact administration.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Include shop name in response for UI convenience
    let shopName = null;
    if (user.shop_id) {
      const shopRes = await pool.query('SELECT name FROM shops WHERE id = $1', [user.shop_id]);
      shopName = shopRes.rows[0]?.name;
    }

    // Generate a unique token ID used as the in-memory cache key
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const token = jwt.sign(
      {
        jti,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop_id: user.shop_id,
        shop_name: shopName
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store token in in-memory cache — nothing written to disk or DB
    tokenCache.addToken(jti, user.id, expiresAt);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shop_id: user.shop_id,
        shop_name: shopName
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database server error during login.' });
  }
};

// 2. Create Admin Account (SuperAdmin Only)
const createAdmin = async (req, res) => {
  const { name, email, password, shop_id } = req.body;

  if (!name || !email || !password || !shop_id) {
    return res.status(400).json({ error: 'Name, email, password, and shop_id are required.' });
  }

  try {
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const shopRes = await pool.query('SELECT id FROM shops WHERE id = $1', [shop_id]);
    if (shopRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid shop_id.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newAdmin = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, shop_id, is_active) 
       VALUES ($1, $2, $3, 'Admin', $4, true) 
       RETURNING id, name, email, role, shop_id, is_active`,
      [name, email, passwordHash, shop_id]
    );

    res.status(201).json(newAdmin.rows[0]);
  } catch (err) {
    console.error('Create Admin error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 3. Create Employee/Chef Account (Admin or SuperAdmin)
const createEmployee = async (req, res) => {
  const { name, email, password, role, shop_id } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  if (!['Employee', 'Chef'].includes(role)) {
    return res.status(400).json({ error: 'Role must be Employee or Chef.' });
  }

  // Determine shop_id
  let targetShopId = shop_id;
  if (req.user.role === 'Admin') {
    targetShopId = req.user.shop_id;
  } else if (req.user.role === 'SuperAdmin') {
    if (!targetShopId) {
      return res.status(400).json({ error: 'shop_id is required for SuperAdmin.' });
    }
  }

  try {
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const shopRes = await pool.query('SELECT id FROM shops WHERE id = $1', [targetShopId]);
    if (shopRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid shop_id.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newEmployee = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, shop_id, is_active) 
       VALUES ($1, $2, $3, $4, $5, true) 
       RETURNING id, name, email, role, shop_id, is_active`,
      [name, email, passwordHash, role, targetShopId]
    );

    res.status(201).json(newEmployee.rows[0]);
  } catch (err) {
    console.error('Create Employee error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 4. List Employees/Users
const listUsers = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'SuperAdmin') {
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.shop_id, u.is_active, s.name as shop_name 
         FROM users u 
         LEFT JOIN shops s ON u.shop_id = s.id 
         ORDER BY u.role, u.name`
      );
    } else if (req.user.role === 'Admin') {
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.shop_id, u.is_active, s.name as shop_name 
         FROM users u 
         LEFT JOIN shops s ON u.shop_id = s.id 
         WHERE u.shop_id = $1 
         ORDER BY u.role, u.name`,
        [req.user.shop_id]
      );
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 5. Toggle Active/Archive User (Admin for shop, SuperAdmin for all)
const toggleArchiveUser = async (req, res) => {
  const { id } = req.params;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const targetUser = userRes.rows[0];

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Role checks
    if (req.user.role === 'Admin' && targetUser.shop_id !== req.user.shop_id) {
      return res.status(403).json({ error: 'Forbidden. User belongs to another shop.' });
    }

    if (targetUser.role === 'SuperAdmin') {
      return res.status(400).json({ error: 'SuperAdmin account status cannot be toggled.' });
    }

    const newActiveState = !targetUser.is_active;
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [newActiveState, id]);

    res.json({ message: `User account has been ${newActiveState ? 'activated' : 'archived'} successfully.` });
  } catch (err) {
    console.error('Toggle archive user error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 6. Delete User Account (SuperAdmin or Admin for their shop's cashiers/chefs)
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const targetUser = userRes.rows[0];

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.role === 'SuperAdmin') {
      return res.status(400).json({ error: 'Static SuperAdmin account cannot be deleted.' });
    }

    // Admin can delete, but only for employees/chefs under their own shop
    if (req.user.role === 'Admin') {
      if (targetUser.shop_id !== req.user.shop_id || targetUser.role === 'Admin') {
        return res.status(403).json({ error: 'Forbidden. Admins can only delete cashiers/chefs in their shop.' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User account deleted successfully.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

// 7. Change User Password
const changePassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const targetUser = userRes.rows[0];

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Role checks
    const isSelf = req.user.id === parseInt(id);
    const isSuper = req.user.role === 'SuperAdmin';
    const isAdminOfShop = req.user.role === 'Admin' && targetUser.shop_id === req.user.shop_id;

    if (!isSelf && !isSuper && !isAdminOfShop) {
      return res.status(403).json({ error: 'Forbidden. You cannot change this password.' });
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Database server error.' });
  }
};

module.exports = {
  login,
  createAdmin,
  createEmployee,
  listUsers,
  toggleArchiveUser,
  deleteUser,
  changePassword
};
