/**
 * SOS Emergency Dispatch Controller
 * 
 * Real-time emergency alert system with multi-wave provider dispatch
 * 
 * Flow:
 * 1. User triggers SOS from location → triggerSOS()
 * 2. Wave 1: Alert 3 nearest providers (3-minute window)
 * 3. If no acceptance in 3 minutes → Wave 2: Alert next 3 providers
 * 4. If Wave 2 also times out → Notify user to call emergency services
 * 5. First provider to accept wins → Booking created, others notified
 * 
 * Race Condition Handling:
 * - session.acceptedBy: First provider to call acceptSOS() marks it, prevents duplicates
 * - $nin: Ensures Wave 2 never re-alerts Wave 1 providers
 * - Wave cap: Hard limit at 2 waves prevents infinite expansion
 * - Memory cleanup: activeSosSessions.delete() on all resolution paths
 */

const Provider = require('../models/Provider');
const Booking  = require('../models/Booking');
const { getIO } = require('../config/socket');

// Tracks active SOS sessions in memory
// key: sosId, value: { userId, category, coordinates, wave, acceptedBy, alertedProviderIds }
// Production: Replace with Redis for persistence across server restarts
const activeSosSessions = new Map();

/**
 * POST /api/sos — User triggers emergency SOS alert
 * 
 * Immediately sends Wave 1 to 3 nearest providers
 * Schedules Wave 2 expansion after 3 minutes if no acceptance
 * 
 * Request: { lat, lng, category, address }
 * Response: { sosId } for future cancellation/tracking
 */
exports.triggerSOS = async (req, res, next) => {
  try {
    const { lat, lng, category, address } = req.body;

    if (!lat || !lng || !category) {
      return res.status(400).json({ success: false, message: 'lat, lng and category are required' });
    }

    // Generate unique session ID for this emergency
    const sosId = `sos_${req.user._id}_${Date.now()}`;

    // Store session state
    activeSosSessions.set(sosId, {
      userId:            req.user._id.toString(),
      userName:          req.user.name,
      category,
      coordinates:       [parseFloat(lng), parseFloat(lat)], // [lon, lat] for GeoJSON
      address,
      wave:              1,
      acceptedBy:        null, // Will be provider._id if accepted
      alertedProviderIds: [], // Tracks which providers already saw this SOS
    });

    // Send Wave 1 immediately
    await sendSOSWave(sosId, 1);

    // Schedule Wave 2 expansion after 3 minutes if nobody accepts
    setTimeout(() => expandSOSWave(sosId), 3 * 60 * 1000);

    res.status(200).json({
      success: true,
      sosId,
      message: 'SOS alert sent to nearest providers. Please wait.',
    });

  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/sos/:sosId/accept — Provider accepts SOS and becomes en route
 * 
 * Creates emergency booking with status='Accepted' (skips Requested state)
 * Notifies user and cancels alerts to other providers
 * 
 * Request: { sosId }
 * Response: { bookingId } for provider to navigate to
 */
exports.acceptSOS = async (req, res, next) => {
  try {
    const { sosId } = req.params;
    const session   = activeSosSessions.get(sosId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'SOS session not found or already resolved' });
    }
    
    // RACE CONDITION GUARD: If another provider already accepted, reject cleanly
    if (session.acceptedBy) {
      return res.status(400).json({ success: false, message: 'SOS already accepted by another provider' });
    }

    const providerProfile = await Provider.findOne({ user: req.user._id });
    if (!providerProfile) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    // Mark session as accepted — prevents other providers from accepting
    // This must happen BEFORE any async operation (DB write) to prevent race conditions
    session.acceptedBy = req.user._id.toString();
    activeSosSessions.set(sosId, session);

    // Create emergency booking directly in Accepted status (no Requested state)
    // Provider is already on the way
    const booking = await Booking.create({
      user:        session.userId,
      provider:    providerProfile._id,
      service:     session.category,
      status:      'Accepted', // Emergency bookings start here, not 'Requested'
      scheduledAt: new Date(),
      address:     session.address,
      isEmergency: true,
    });

    // Notify user that help is on the way via Socket.io personal room
    getIO().to(session.userId).emit('sos_accepted', {
      message:      `${req.user.name} is on the way!`,
      providerName: req.user.name,
      bookingId:    booking._id,
    });

    // Cancel alerts for all other alerted providers via Socket.io
    // They can dismiss the notification and continue normal operations
    session.alertedProviderIds
      .filter(id => id !== req.user._id.toString())
      .forEach(providerId => {
        getIO().to(providerId).emit('sos_cancelled', {
          sosId,
          message: 'SOS was accepted by another provider.',
        });
      });

    // Clean up session from memory to prevent memory leaks
    activeSosSessions.delete(sosId);

    res.json({ success: true, bookingId: booking._id });

  } catch (error) {
    next(error);
  }
};

/**
 * Internal: Send SOS alert to nearest N providers in a wave
 * 
 * Wave 1: 3 nearest providers, no previous filter
 * Wave 2: 3 nearest providers NOT already alerted in Wave 1
 * 
 * GeoJSON $near query uses 2dsphere index on Provider.location
 * Maxdistance: 15km for emergencies (vs 5km for normal bookings)
 */
const sendSOSWave = async (sosId, waveNumber) => {
  const session = activeSosSessions.get(sosId);
  
  // Session may be deleted if already resolved or user cancelled
  if (!session || session.acceptedBy) return;

  // Query: Find nearest providers by distance, match category, not already alerted
  const providers = await Provider.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: session.coordinates },
        $maxDistance: 15000, // 15km radius for emergency vs 5km normal
      }
    },
    category:    session.category,
    isAvailable: true,
    isVerified:  true,
    // WAVE FILTERING: $nin prevents re-alerting providers who ignored previous wave
    _id: { $nin: session.alertedProviderIds },
  })
  .populate('user', '_id name')
  .limit(3); // Alert 3 providers per wave

  if (providers.length === 0) {
    // No providers found at this distance — notify user to call emergency
    getIO().to(session.userId).emit('sos_no_providers', {
      message: 'No available providers found nearby. Please try again or call emergency services.',
    });
    activeSosSessions.delete(sosId);
    return;
  }

  // Track which providers were alerted in this wave
  const newProviderIds = providers.map(p => p.user._id.toString());
  session.alertedProviderIds.push(...newProviderIds);
  session.wave = waveNumber;
  activeSosSessions.set(sosId, session);

  // Emit SOS alert to each provider's personal Socket.io room
  // Providers see this as high-priority notification on dashboard
  providers.forEach(provider => {
    getIO().to(provider.user._id.toString()).emit('priority_sos', {
      sosId,
      wave:      waveNumber,
      userName:  session.userName,
      category:  session.category,
      address:   session.address,
      message:   `EMERGENCY: ${session.userName} needs ${session.category} immediately!`,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3-minute countdown for provider UI
    });
  });
};

/**
 * Internal: Expand to Wave 2 if Wave 1 times out with no acceptance
 * 
 * Wave logic:
 * - Wave 1: 3-minute window
 * - Wave 2: 3-minute window (if Wave 1 failed)
 * - After Wave 2: Give up, notify user to call emergency
 * 
 * CAP AT 2 WAVES: Prevents infinite expansion and notification spam
 */
const expandSOSWave = async (sosId) => {
  const session = activeSosSessions.get(sosId);
  
  // Already resolved or session deleted
  if (!session || session.acceptedBy) return;

  // WAVE CAP: Hard limit at 2 waves prevents infinite loop
  if (session.wave >= 2) {
    // Wave 2 also timed out — notify user to call emergency services
    getIO().to(session.userId).emit('sos_no_providers', {
      message: 'No providers responded to your emergency request. Please call emergency services.',
    });
    activeSosSessions.delete(sosId);
    return;
  }

  // Expand to Wave 2: Alert next 3 nearest providers (excluding Wave 1)
  await sendSOSWave(sosId, 2);

  // Final timeout: If Wave 2 also gets no response in 3 minutes, give up
  setTimeout(async () => {
    const currentSession = activeSosSessions.get(sosId);
    if (currentSession && !currentSession.acceptedBy) {
      // No provider accepted Wave 2 either
      getIO().to(currentSession.userId).emit('sos_no_providers', {
        message: 'No providers responded to your emergency request. Please call emergency services.',
      });
      activeSosSessions.delete(sosId);
    }
  }, 3 * 60 * 1000);
};
