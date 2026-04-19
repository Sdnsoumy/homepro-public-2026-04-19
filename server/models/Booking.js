const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  service:  { type: String, required: true },
  status:   { type: String, enum: ['Requested','Accepted','Rejected','In-Progress','Completed','Cancelled'], default: 'Requested' },
  scheduledAt:  { type: Date, required: true },
  completedAt:  { type: Date },
  address:      { type: String, required: true },
  
  // Payment fields for Razorpay integration
  totalAmount:     { type: Number, required: true }, // in rupees (cents would be * 100 for API)
  paymentType:     { type: String, enum: ['prepaid', 'postpaid'], default: 'postpaid' },
  isPaid:          { type: Boolean, default: false },
  paymentId:       { type: String }, // Razorpay payment_id after successful payment
  razorpayOrderId: { type: String }, // Razorpay order_id created on server
  
  isEmergency:  { type: Boolean, default: false },
  notes:        { type: String, maxlength: 300 },
  autoRejectAt: { type: Date }, // set to createdAt + 5 minutes
  cancelledBy:  { type: String, enum: ['user', 'provider', 'system'] },
  cancelReason: { type: String, maxlength: 300 },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);