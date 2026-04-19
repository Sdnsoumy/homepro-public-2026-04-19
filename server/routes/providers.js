const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middlewares/auth');
const { getNearbyProviders, registerAsProvider } = require('../controllers/providerController');

router.get('/nearby', getNearbyProviders);
router.post('/register', protect, authorize('provider'), registerAsProvider);

module.exports = router;