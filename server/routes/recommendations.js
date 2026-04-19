/**
 * Recommendations Routes
 * 
 * Provides smart seasonal recommendations for service categories
 * Frontend uses this to suggest popular services based on season
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { getRecommendations } = require('../utils/recommendations');

/**
 * GET /api/recommendations
 * Returns recommended service categories for current month
 * 
 * Response: { success, month, recommendations: [], message }
 * Example: { month: "April", recommendations: ["AC Repair", "Electrician"] }
 */
router.get('/', protect, (req, res) => {
  const categories = getRecommendations();
  const month = new Date().toLocaleString('default', { month: 'long' });

  res.json({
    success: true,
    month,
    recommendations: categories,
    message: `Services recommended for ${month}`,
  });
});

module.exports = router;
