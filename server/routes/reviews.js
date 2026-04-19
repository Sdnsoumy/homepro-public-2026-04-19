const express = require('express');
const router  = express.Router();
const upload  = require('../config/multer');
const { protect, authorize } = require('../middlewares/auth');
const { createReview, getProviderReviews } = require('../controllers/reviewController');

router.post('/',
  protect,
  authorize('user'),
  upload.array('photos', 3), // 'photos' must match FormData field name in Angular
  createReview
);

router.get('/provider/:providerId', getProviderReviews);

module.exports = router;