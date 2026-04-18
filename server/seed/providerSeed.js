const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const User     = require('../models/User');
const Provider = require('../models/Provider');

dotenv.config({ path: '../.env' });

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // Create a test user with provider role
  const user = await User.create({
    name:     'Raju Electrician',
    email:    'raju@test.com',
    password: 'password123',
    phone:    '9876543210',
    role:     'provider',
  });

  // Create provider profile — use coordinates of your own city
  // These are Bhubaneswar coordinates
  await Provider.create({
    user:        user._id,
    category:    'Electrician',
    description: 'Expert in home wiring and repairs',
    experience:  5,
    hourlyRate:  300,
    isAvailable: true,
    isVerified:  true,
    badge:       'Gold',
    avgRating:   4.7,
    location: {
      type:        'Point',
      coordinates: [85.8245, 20.2961], // [longitude, latitude] of Bhubaneswar
    }
  });

  console.log('Seed complete');
  process.exit(0);
};

seed();