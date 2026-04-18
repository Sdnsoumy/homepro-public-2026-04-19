const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  service:  { type: String, required: true },
  status:   { type: String, enum: ['Requested','Accepted','Rejected','In-Progress','Completed','Cancelled'], default: 'Requested' },
  scheduledAt:  { type: Date, required: true },
  completedAt:  { type: Date },
  address:      { type: String, required: true },
  totalAmount:  { type: Number },
  isPaid:       { type: Boolean, default: false },
  isEmergency:  { type: Boolean, default: false },
  notes:        { type: String, maxlength: 300 },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);