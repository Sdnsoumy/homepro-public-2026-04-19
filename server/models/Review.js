/**
 * Review Model
 * 
 * Stores user reviews for completed bookings
 * One review per booking - enforced by unique constraint on booking field
 * 
 * Edge Cases Handled:
 * - unique: true on booking prevents duplicate reviews for same job (DB-level enforcement)
 * - Photos are stored as file paths (uploaded to server/public/reviews/)
 * - isVisible allows admin to hide inappropriate or spam reviews
 * - createdAt timestamps track when review was submitted
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  booking:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking',  required: true, unique: true },
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  
  // Review content
  rating:   { type: Number, required: true, min: 1, max: 5 },
  comment:  { type: String, required: true, maxlength: 500, trim: true },
  
  // Photos: array of file paths (max 3), uploaded via multer
  photos:   [{ type: String }],
  
  // Visibility control for admin moderation
  isVisible: { type: Boolean, default: true },
  
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
