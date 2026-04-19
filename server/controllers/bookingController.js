const Booking  = require('../models/Booking');
const Provider = require('../models/Provider');
const { getIO } = require('../config/socket');
const { scheduleAutoReject } = require('../utils/autoReject');

/**
 * POST /api/bookings — User creates a booking request
 * 
 * Validation:
 * - Provider exists, is available, and is verified
 * - No time slot conflicts with existing active bookings
 * 
 * Side Effects:
 * - Creates Booking doc with status='Requested' and autoRejectAt=now+5min
 * - Emits 'new_booking' socket event to provider's room (real-time notification)
 * - Schedules auto-reject timeout via scheduleAutoReject()
 * 
 * Socket Flow:
 * Provider sees incoming notification on their dashboard with 5-minute countdown.
 * If provider doesn't respond, auto-reject fires at timeout.
 */
exports.createBooking = async (req, res, next) => {
  try {
    const { providerId, service, scheduledAt, address, notes, isEmergency } = req.body;

    // Verify provider exists and is available
    const provider = await Provider.findById(providerId).populate('user', 'name');
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }
    if (!provider.isAvailable) {
      return res.status(400).json({ success: false, message: 'Provider is not available' });
    }
    if (!provider.isVerified) {
      return res.status(400).json({ success: false, message: 'Provider is not verified yet' });
    }

    // Slot conflict check — prevent double booking
    // Query for any 'Accepted' or 'In-Progress' bookings in ±1 hour window
    const conflictingBooking = await Booking.findOne({
      provider:   providerId,
      status:     { $in: ['Accepted', 'In-Progress'] },
      scheduledAt: {
        $gte: new Date(new Date(scheduledAt).getTime() - 60 * 60 * 1000), // 1hr before
        $lte: new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000), // 1hr after
      }
    });
    if (conflictingBooking) {
      return res.status(400).json({ success: false, message: 'Provider already has a booking at this time' });
    }

    // Set auto-reject time to 5 minutes from now (300,000 milliseconds)
    const autoRejectAt = new Date(Date.now() + 5 * 60 * 1000);

    // Create new booking with status='Requested' (initial state)
    const booking = await Booking.create({
      user:        req.user._id,
      provider:    providerId,
      service,
      scheduledAt: new Date(scheduledAt),
      address,
      notes,
      isEmergency: isEmergency || false,
      autoRejectAt, // Stores when this booking will auto-reject
    });

    // Populate references for notification payload (name, category, etc.)
    const populatedBooking = await Booking.findById(booking._id)
      .populate('user',     'name phone avatar')
      .populate('provider', 'category hourlyRate');

    // Emit real-time notification to the provider via Socket.io.
    // Uses personal room pattern: io.to(userId) emits only to that provider.
    getIO().to(provider.user._id.toString()).emit('new_booking', {
      booking:   populatedBooking,
      expiresAt: autoRejectAt, // Passed to frontend for countdown timer
      message:   `New booking request from ${req.user.name}`,
    });

    // Schedule auto-reject after 5 minutes if provider hasn't responded
    // If provider accepts/rejects before timeout, autoReject utility checks status
    // and bails out silently to avoid overwriting the provider's action.
    scheduleAutoReject(booking._id, provider.user._id.toString(), autoRejectAt);

    res.status(201).json({ success: true, data: populatedBooking });

  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bookings/:id/status — Provider or user updates booking status
 * 
 * Main Workflows:
 * 1. Provider Accept: Requested → Accepted (5-min window accepted)
 * 2. Provider Reject: Requested → Rejected (user notified, can rebook)
 * 3. Provider Start: Accepted → In-Progress (marks provider unavailable)
 * 4. Provider Complete: In-Progress → Completed (marks provider available again)
 * 5. Cancel: Requested/Accepted → Cancelled (disallowed if In-Progress)
 * 
 * Socket.io Side Effects:
 * - Accepts/Rejects within 5-minute window trigger socket notifications to user room
 * - Every status change emits via personal room pattern (io.to(userId))
 * - Auto-reject timeout's status check prevents overwriting provider's explicit response
 */
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status, cancelReason } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate('user',     'name')
      .populate('provider');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Authorization: Verify provider/user owns this booking
    if (req.user.role === 'provider') {
      const providerProfile = await Provider.findOne({ user: req.user._id });
      if (!providerProfile || booking.provider._id.toString() !== providerProfile._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not your booking' });
      }
    }

    // State machine: Define valid booking status transitions
    // Ensures booking lifecycle follows proper sequence
    const validTransitions = {
      'Requested':   ['Accepted', 'Rejected', 'Cancelled'],
      'Accepted':    ['In-Progress', 'Cancelled'],
      'In-Progress': ['Completed'],
      'Completed':   [],
      'Rejected':    [],
      'Cancelled':   [],
    };

    // Validate transition is allowed
    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move booking from '${booking.status}' to '${status}'`
      });
    }

    // Cancellation rules: Disallow cancelling in-progress jobs
    if (status === 'Cancelled') {
      if (booking.status === 'In-Progress') {
        return res.status(400).json({ success: false, message: 'Cannot cancel a job that is already In-Progress' });
      }
      booking.cancelledBy  = req.user.role;
      booking.cancelReason = cancelReason || '';
    }

    // Track completion timestamp
    if (status === 'Completed') {
      booking.completedAt = new Date();
    }

    // Update status
    booking.status = status;
    await booking.save();

    // Record response time when provider accepts booking
    if (status === 'Accepted') {
      // Calculate how long it took provider to respond (in milliseconds)
      const responseTimeMs = Date.now() - new Date(booking.createdAt).getTime();

      // Update provider's cumulative response time and response count
      await Provider.findByIdAndUpdate(booking.provider._id, {
        $inc: {
          totalResponseTimeMs: responseTimeMs,
          totalResponses:      1,
        }
      });

      // Recalculate average response time for badge calculation
      const provider = await Provider.findById(booking.provider._id);
      provider.avgResponseTimeMs = provider.totalResponseTimeMs / provider.totalResponses;
      await provider.save();
    }

    // Socket.io notification map: Each status triggers specific user notification
    // User receives real-time updates about their booking via personal room
    const notificationMap = {
      'Accepted':    { event: 'booking_accepted',    message: `${booking.provider.category} provider accepted your booking!` },
      'Rejected':    { event: 'booking_rejected',    message: 'Your booking was rejected. Please try another provider.' },
      'In-Progress': { event: 'booking_in_progress', message: 'Your service provider has started the job.' },
      'Completed':   { event: 'booking_completed',   message: 'Job completed! Please leave a review.' },
      'Cancelled':   { event: 'booking_cancelled',   message: `Booking cancelled by ${req.user.role}.` },
    };

    // Emit notification to user via Socket.io (personal room pattern)
    const notification = notificationMap[status];
    if (notification) {
      getIO().to(booking.user._id.toString()).emit(notification.event, {
        bookingId: booking._id,
        message:   notification.message,
        booking,
      });
    }

    // Manage provider availability based on booking state
    // In-Progress: Mark unavailable (single-booking provider)
    // Completed/Cancelled: Mark available again
    if (status === 'In-Progress') {
      await Provider.findByIdAndUpdate(booking.provider._id, { isAvailable: false });
    }
    if (status === 'Completed' || status === 'Cancelled') {
      await Provider.findByIdAndUpdate(booking.provider._id, { isAvailable: true });
    }

    res.json({ success: true, data: booking });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bookings/my — User views their own bookings
 * Returns all bookings created by the authenticated user.
 */
exports.getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('provider', 'category hourlyRate badge avgRating')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/provider — Provider sees their assigned bookings
exports.getProviderBookings = async (req, res, next) => {
  try {
    const providerProfile = await Provider.findOne({ user: req.user._id });
    if (!providerProfile) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    const bookings = await Booking.find({ provider: providerProfile._id })
      .populate('user', 'name phone avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
};