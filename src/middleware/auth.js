const jwt = require('jsonwebtoken');
const pool = require('../../db');

// Verify token and attach user to request object (async to check db state)
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'odoocafesupersecretkey12345!');
    
    // Stateful check: Verify the token exists in the database and is still valid
    const tokenCheck = await pool.query(
      'SELECT 1 FROM jwt_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );

    if (tokenCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or token revoked.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Check if user has one of the required roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    
    next();
  };
};

// Enforce that Admin/Employee/Chef can only access assets within their own shop
const checkShopMatch = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  // SuperAdmin bypasses shop restriction
  if (req.user.role === 'SuperAdmin') {
    return next();
  }

  // Retrieve shopId from query, params, or body depending on request
  const requestShopId = req.params.shopId || req.query.shopId || req.body.shop_id || req.body.shopId;

  if (requestShopId && parseInt(requestShopId) !== req.user.shop_id) {
    return res.status(403).json({ error: 'Forbidden. You do not have access to this shop.' });
  }

  next();
};

module.exports = {
  verifyToken,
  requireRole,
  checkShopMatch
};
