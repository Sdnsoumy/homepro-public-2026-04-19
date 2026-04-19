const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { createOrder, verifyPayment } = require('../controllers/paymentController');

router.post('/create-order', protect, authorize('user'), createOrder);
router.post('/verify',       protect, authorize('user'), verifyPayment);

module.exports = router;