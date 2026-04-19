/**
 * Auto-reject Utility: Implements 5-minute booking request timeout
 * 
 * Overview:
 * When a user creates a booking, the system schedules auto-reject via setTimeout.
 * If provider doesn't accept/reject within 5 minutes, auto-reject fires.
 * 
 * Critical Race Condition Guard:
 * Between scheduling and timeout firing, provider may have already accepted/rejected.
 * Auto-reject checks booking.status !== 'Requested' before updating.
 * If provider responded, status will be 'Accepted'/'Rejected' → auto-reject silently exits.
 * This prevents overwriting provider's actual response with system-driven rejection.
 * 
 * Socket.io Notifications:
 * - User: 'booking_rejected' with autoRejected=true flag
 * - Provider: 'booking_expired' (signal to clear UI countdown)
 * 
 * Production Note:
 * setTimeout lives in Node process memory. Server restart loses pending timeouts.
 * For production: Use job queue (bull, agenda, or similar) for persistence.
 */

const Booking = require('../models/Booking');
const Provider = require('../models/Provider');
const { getIO } = require('../config/socket');

/**
 * Schedules auto-rejection of a booking if provider doesn't respond.
 * 
 * @param {String} bookingId - Booking document _id
 * @param {String} providerUserId - Provider's user _id (for socket room emit)
 * @param {Date} rejectAt - ISO timestamp when rejection should occur (5 min from creation)
 */
const scheduleAutoReject = (bookingId, providerUserId, rejectAt) => {
  // Calculate delay in milliseconds from now until rejection time
  const delay = rejectAt.getTime() - Date.now();

  // If already expired, skip (shouldn't happen, but defensive)
  if (delay <= 0) return;

  // Fire callback after delay
  setTimeout(async () => {
    try {
      // Fetch fresh booking document from DB
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name');

      /**
       * CRITICAL: Status guard prevents race condition.
       * If provider accepted/rejected between scheduling and now,
       * booking.status will be 'Accepted' or 'Rejected' (not 'Requested').
       * In that case, silently return without modifying the booking.
       * This allows provider's explicit response to take precedence.
       */
      if (!booking || booking.status !== 'Requested') return;

      // Update to Rejected status
      booking.status = 'Rejected';
      booking.cancelledBy = 'system'; // Marks this as system-triggered, not provider action
      booking.cancelReason = 'Provider did not respond within 5 minutes';
      await booking.save();

      // Notify the user their booking was auto-rejected.
      // Personal room pattern: Only this user receives the notification.
      getIO().to(booking.user._id.toString()).emit('booking_rejected', {
        bookingId: booking._id,
        message: 'Provider did not respond in time. Please try another provider.',
        autoRejected: true, // Frontend can use this flag for different UX (e.g., "auto-rejected")
      });

      // Notify the provider the response window expired.
      // Personal room pattern: Only this provider receives the notification.
      getIO().to(providerUserId).emit('booking_expired', {
        bookingId: booking._id,
        message: 'A booking request expired because you did not respond in time.',
      });

    } catch (error) {
      console.error('Auto-reject error:', error.message);
    }
  }, delay);
};

module.exports = { scheduleAutoReject };
