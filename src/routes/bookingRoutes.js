const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Get Table Info by QR Token
router.get('/table/:qrToken', bookingController.getTableInfo);

// Initiate Booking (Check capacity)
router.post('/table/:qrToken/initiate', bookingController.initiateBooking);

// Submit Order via QR
router.post('/order', bookingController.submitOrder);

module.exports = router;
