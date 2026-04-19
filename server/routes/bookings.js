const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const {
  createBooking,
  updateBookingStatus,
  getMyBookings,
  getProviderBookings,
} = require('../controllers/bookingController');

router.post('/', protect, authorize('user'), createBooking);
router.patch('/:id/status', protect, updateBookingStatus);
router.get('/my', protect, authorize('user'), getMyBookings);
router.get('/provider', protect, authorize('provider'), getProviderBookings);

module.exports = router;
