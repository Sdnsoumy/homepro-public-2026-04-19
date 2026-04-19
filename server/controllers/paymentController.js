const crypto   = require('crypto');
const razorpay = require('../config/razorpay');
const Booking  = require('../models/Booking');

// POST /api/payments/create-order
// Called when user is ready to pay (either at booking or after completion)
exports.createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Verify this booking belongs to the requesting user
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your booking' });
    }

    // Prevent double payment
    if (booking.isPaid) {
      return res.status(400).json({ success: false, message: 'Booking already paid' });
    }

    // For postpaid — only allow payment after job is completed
    if (booking.paymentType === 'postpaid' && booking.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Postpaid bookings can only be paid after job completion' });
    }

    // For prepaid — only allow payment when booking is Requested or Accepted
    if (booking.paymentType === 'prepaid' && !['Requested', 'Accepted'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Prepaid payment window has passed' });
    }

    // Create Razorpay order
    // Amount must be in paise (1 INR = 100 paise)
    const order = await razorpay.orders.create({
      amount:   booking.totalAmount * 100,
      currency: 'INR',
      receipt:  `booking_${bookingId}`,
      notes: {
        bookingId: bookingId,
        userId:    req.user._id.toString(),
      }
    });

    // Save order ID to booking for verification later
    booking.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      success: true,
      order: {
        id:       order.id,
        amount:   order.amount,
        currency: order.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID, // Frontend needs this to open checkout
    });

  } catch (error) {
    next(error);
  }
};

// POST /api/payments/verify
// Called after Razorpay returns payment success to frontend
exports.verifyPayment = async (req, res, next) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Verify the payment signature using HMAC SHA256
    // This is the critical security step — prevents fake payment confirmations
    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed — invalid signature' });
    }

    // Payment is genuine — update booking
    booking.isPaid    = true;
    booking.paymentId = razorpay_payment_id;
    await booking.save();

    res.json({ success: true, message: 'Payment verified successfully' });

  } catch (error) {
    next(error);
  }
};