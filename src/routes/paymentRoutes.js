const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Create Razorpay Order
router.post('/razorpay/create-order', paymentController.createRazorpayOrder);

// Verify Razorpay Payment
router.post('/razorpay/verify', paymentController.verifyRazorpayPayment);

// Handle COD
router.post('/cod', paymentController.handleCOD);

module.exports = router;
