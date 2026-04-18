const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category:    { type: String, enum: ['Electrician','Plumber','Home Cleaning','Carpenter','Painter','AC Repair'], required: true },
  description: { type: String, maxlength: 500 },
  experience:  { type: Number, default: 0 },
  hourlyRate:  { type: Number, required: true },
  isAvailable: { type: Boolean, default: true },
  isVerified:  { type: Boolean, default: false },
  badge:       { type: String, enum: ['None','Bronze','Silver','Gold'], default: 'None' },
  avgRating:   { type: Number, default: 0, min: 0, max: 5 },
  totalJobs:   { type: Number, default: 0 },
  location: {
    type:        { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true }  // [longitude, latitude]
  },
  workingHours: {
    start: { type: String, default: '08:00' },
    end:   { type: String, default: '20:00' }
  }
}, { timestamps: true });

// THIS IS THE MOST CRITICAL LINE IN PHASE 1
providerSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Provider', providerSchema);