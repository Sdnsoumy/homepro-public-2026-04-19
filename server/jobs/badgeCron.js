const cron     = require('node-cron');
const Provider = require('../models/Provider');
const Booking  = require('../models/Booking');

// Badge thresholds — adjust these based on your platform standards
const BADGE_THRESHOLDS = {
  Gold: {
    minAvgRating:        4.5,
    minCompletionRate:   0.90, // 90%
    maxAvgResponseMs:    120000, // 2 minutes
    minTotalJobs:        20,
  },
  Silver: {
    minAvgRating:        4.0,
    minCompletionRate:   0.75, // 75%
    maxAvgResponseMs:    300000, // 5 minutes
    minTotalJobs:        10,
  },
  Bronze: {
    minAvgRating:        3.5,
    minCompletionRate:   0.60, // 60%
    maxAvgResponseMs:    600000, // 10 minutes
    minTotalJobs:        3,
  },
};

const calculateBadge = (stats) => {
  const { avgRating, completionRate, avgResponseTimeMs, totalJobs } = stats;

  // Check Gold first — most restrictive
  if (
    avgRating        >= BADGE_THRESHOLDS.Gold.minAvgRating &&
    completionRate   >= BADGE_THRESHOLDS.Gold.minCompletionRate &&
    avgResponseTimeMs <= BADGE_THRESHOLDS.Gold.maxAvgResponseMs &&
    totalJobs        >= BADGE_THRESHOLDS.Gold.minTotalJobs
  ) return 'Gold';

  if (
    avgRating        >= BADGE_THRESHOLDS.Silver.minAvgRating &&
    completionRate   >= BADGE_THRESHOLDS.Silver.minCompletionRate &&
    avgResponseTimeMs <= BADGE_THRESHOLDS.Silver.maxAvgResponseMs &&
    totalJobs        >= BADGE_THRESHOLDS.Silver.minTotalJobs
  ) return 'Silver';

  if (
    avgRating        >= BADGE_THRESHOLDS.Bronze.minAvgRating &&
    completionRate   >= BADGE_THRESHOLDS.Bronze.minCompletionRate &&
    avgResponseTimeMs <= BADGE_THRESHOLDS.Bronze.maxAvgResponseMs &&
    totalJobs        >= BADGE_THRESHOLDS.Bronze.minTotalJobs
  ) return 'Bronze';

  return 'None';
};

const runBadgeUpdate = async () => {
  console.log('Badge cron started:', new Date().toISOString());

  try {
    const providers = await Provider.find({ isVerified: true });

    for (const provider of providers) {
      // Get all bookings for this provider
      const allBookings       = await Booking.find({ provider: provider._id });
      const completedBookings = allBookings.filter(b => b.status === 'Completed');
      const rejectedOrCancelled = allBookings.filter(
        b => b.status === 'Rejected' || b.status === 'Cancelled'
      );

      const totalJobs      = allBookings.length;
      const completionRate = totalJobs > 0
        ? completedBookings.length / totalJobs
        : 0;

      const stats = {
        avgRating:         provider.avgRating,
        completionRate,
        avgResponseTimeMs: provider.avgResponseTimeMs || Infinity,
        totalJobs,
      };

      const newBadge = calculateBadge(stats);

      // Only update if badge changed — avoid unnecessary DB writes
      if (provider.badge !== newBadge) {
        await Provider.findByIdAndUpdate(provider._id, {
          badge:      newBadge,
          totalJobs,
        });
        console.log(`Provider ${provider._id}: ${provider.badge} → ${newBadge}`);
      }
    }

    console.log('Badge cron completed:', new Date().toISOString());

  } catch (error) {
    console.error('Badge cron error:', error.message);
  }
};

// Schedule: runs every day at midnight
// Cron syntax: second minute hour day month weekday
const startBadgeCron = () => {
  cron.schedule('0 0 * * *', runBadgeUpdate, {
    timezone: 'Asia/Kolkata', // IST timezone
  });
  console.log('Badge cron job scheduled — runs daily at midnight IST');
};

module.exports = { startBadgeCron, runBadgeUpdate };