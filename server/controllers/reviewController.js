const Review   = require('../models/Review');
const Booking  = require('../models/Booking');
const Provider = require('../models/Provider');

// POST /api/reviews
exports.createReview = async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId).populate('provider');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Only the user who made the booking can review it
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your booking' });
    }

    // Review only allowed after job is completed
    if (booking.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Can only review completed jobs' });
    }

    // Review only allowed after payment
    if (!booking.isPaid) {
      return res.status(400).json({ success: false, message: 'Please complete payment before reviewing' });
    }

    // Check review does not already exist (extra guard alongside unique index)
    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this booking' });
    }

    // Build photo paths array from uploaded files
    const photos = req.files
      ? req.files.map(file => `/uploads/reviews/${file.filename}`)
      : [];

    const review = await Review.create({
      booking:  bookingId,
      user:     req.user._id,
      provider: booking.provider._id,
      rating:   parseInt(rating),
      comment,
      photos,
    });

    // Recalculate provider's average rating immediately
    await recalculateProviderRating(booking.provider._id);

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name avatar');

    res.status(201).json({ success: true, data: populatedReview });

  } catch (error) {
    // Handle duplicate review at DB level
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this booking' });
    }
    next(error);
  }
};

// GET /api/reviews/provider/:providerId
exports.getProviderReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({
      provider:  req.params.providerId,
      isVisible: true,
    })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(20);

    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    next(error);
  }
};

// Internal helper — recalculates and saves provider avgRating
const recalculateProviderRating = async (providerId) => {
  const reviews = await Review.find({ provider: providerId, isVisible: true });

  if (reviews.length === 0) return;

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  await Provider.findByIdAndUpdate(providerId, {
    avgRating: Math.round(avgRating * 10) / 10, // round to 1 decimal
  });
};