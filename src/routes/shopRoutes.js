const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Create a shop (SuperAdmin, Admin)
router.post('/', verifyToken, requireRole(['SuperAdmin', 'Admin']), shopController.createShop);

// Update table capacities
router.put('/:shopId/tables', verifyToken, requireRole(['SuperAdmin', 'Admin']), shopController.updateTableCapacities);

module.exports = router;
