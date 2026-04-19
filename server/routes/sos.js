const express = require('express');
const router = express.Router();
const { triggerSOS, acceptSOS } = require('../controllers/sosController');
const { protect } = require('../middlewares/auth');

/**
 * SOS Emergency Dispatch Routes
 * 
 * Architecture:
 * - Wave 1: Alert 3 nearest providers, 3-minute window
 * - Wave 2: If no acceptance, alert next 3 providers, 3-minute window
 * - Fallback: After Wave 2 timeout, notify user to call emergency services
 * 
 * Socket.io Events:
 * - priority_sos: Sent to providers (Wave 1/2)
 * - sos_accepted: Sent to user (provider accepted)
 * - sos_cancelled: Sent to other alerted providers (another provider accepted)
 * - sos_no_providers: Sent to user (no providers available)
 */

/**
 * POST /api/sos
 * User triggers SOS emergency alert
 * 
 * Request body: { lat, lng, category, address }
 * Response: { success, sosId, message }
 * 
 * Categories: 'Electrician','Plumber','Home Cleaning','Carpenter','Painter','AC Repair'
 * Returns sosId for client tracking (optional future use)
 */
router.post('/', protect, triggerSOS);

/**
 * POST /api/sos/:sosId/accept
 * Provider accepts SOS alert and becomes en route
 * 
 * Creates emergency booking with status='Accepted'
 * Notifies user and cancels alerts to other providers
 * Response: { success, bookingId }
 */
router.post('/:sosId/accept', protect, acceptSOS);

module.exports = router;
