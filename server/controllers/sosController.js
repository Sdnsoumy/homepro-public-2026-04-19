const Provider = require('../models/Provider');
const Booking  = require('../models/Booking');
const { getIO } = require('../config/socket');

// Tracks active SOS sessions in memory
// key: sosId, value: { userId, category, coordinates, wave, acceptedBy }
const activeSosSessions = new Map();

// POST /api/sos — User triggers SOS
exports.triggerSOS = async (req, res, next) => {
  try {
    const { lat, lng, category, address } = req.body;

    if (!lat || !lng || !category) {
      return res.status(400).json({ success: false, message: 'lat, lng and category are required' });
    }

    // Generate a unique SOS session ID
    const sosId = `sos_${req.user._id}_${Date.now()}`;

    // Store session
    activeSosSessions.set(sosId, {
      userId:      req.user._id.toString(),
      userName:    req.user.name,
      category,
      coordinates: [parseFloat(lng), parseFloat(lat)],
      address,
      wave:        1,
      acceptedBy:  null,
      alertedProviderIds: [],
    });

    // Start wave 1
    await sendSOSWave(sosId, 1);

    // Schedule wave 2 if nobody accepts in 3 minutes
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

// POST /api/sos/:sosId/accept — Provider accepts SOS
exports.acceptSOS = async (req, res, next) => {
  try {
    const { sosId } = req.params;
    const session   = activeSosSessions.get(sosId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'SOS session not found or already resolved' });
    }
    if (session.acceptedBy) {
      return res.status(400).json({ success: false, message: 'SOS already accepted by another provider' });
    }

    const providerProfile = await Provider.findOne({ user: req.user._id });
    if (!providerProfile) {
      return res.status(404).json({ success: false, message: 'Provider profile not found' });
    }

    // Mark session as accepted — prevents other providers from accepting
    session.acceptedBy = req.user._id.toString();
    activeSosSessions.set(sosId, session);

    // Create the emergency booking
    const booking = await Booking.create({
      user:        session.userId,
      provider:    providerProfile._id,
      service:     session.category,
      status:      'Accepted',
      scheduledAt: new Date(),
      address:     session.address,
      isEmergency: true,
    });

    // Notify the user that help is coming
    getIO().to(session.userId).emit('sos_accepted', {
      message:     `${req.user.name} is on the way!`,
      providerName: req.user.name,
      bookingId:   booking._id,
    });

    // Cancel the SOS alert for all other alerted providers
    session.alertedProviderIds
      .filter(id => id !== req.user._id.toString())
      .forEach(providerId => {
        getIO().to(providerId).emit('sos_cancelled', {
          sosId,
          message: 'SOS was accepted by another provider.',
        });
      });

    // Clean up session
    activeSosSessions.delete(sosId);

    res.json({ success: true, bookingId: booking._id });

  } catch (error) {
    next(error);
  }
};

// Internal function — sends SOS alert to nearest N providers in a wave
const sendSOSWave = async (sosId, waveNumber) => {
  const session = activeSosSessions.get(sosId);
  if (!session || session.acceptedBy) return; // Already resolved

  // Find 3 nearest providers NOT already alerted in previous waves
  const providers = await Provider.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: session.coordinates },
        $maxDistance: 15000, // 15km for emergency
      }
    },
    category:    session.category,
    isAvailable: true,
    isVerified:  true,
    _id: { $nin: session.alertedProviderIds }, // exclude already alerted
  })
  .populate('user', '_id name')
  .limit(3);

  if (providers.length === 0) {
    // No providers found at all — notify the user
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

  // Emit SOS alert to each provider's personal room
  providers.forEach(provider => {
    getIO().to(provider.user._id.toString()).emit('priority_sos', {
      sosId,
      wave:      waveNumber,
      userName:  session.userName,
      category:  session.category,
      address:   session.address,
      message:   `EMERGENCY: ${session.userName} needs ${session.category} immediately!`,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000),
    });
  });
};

// Internal function — expands to next wave if nobody accepted wave 1
const expandSOSWave = async (sosId) => {
  const session = activeSosSessions.get(sosId);
  if (!session || session.acceptedBy) return; // Already resolved

  if (session.wave >= 2) {
    // Already on wave 2 and still no acceptance — give up
    getIO().to(session.userId).emit('sos_no_providers', {
      message: 'No providers responded to your emergency request. Please call emergency services.',
    });
    activeSosSessions.delete(sosId);
    return;
  }

  // Send wave 2 to next 3 nearest providers
  await sendSOSWave(sosId, 2);

  // Final timeout — if wave 2 also gets no response in 3 min
  setTimeout(async () => {
    const currentSession = activeSosSessions.get(sosId);
    if (currentSession && !currentSession.acceptedBy) {
      getIO().to(currentSession.userId).emit('sos_no_providers', {
        message: 'No providers responded to your emergency request. Please call emergency services.',
      });
      activeSosSessions.delete(sosId);
    }
  }, 3 * 60 * 1000);
};