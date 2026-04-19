/**
 * Razorpay Configuration
 * 
 * Initializes Razorpay instance with API credentials from environment variables
 * 
 * Setup:
 * 1. Create free account at dashboard.razorpay.com
 * 2. Navigate to Settings → API Keys
 * 3. Generate test API keys (start with rzp_test_)
 * 4. Add to .env:
 *    RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
 *    RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
 * 
 * Test Credentials:
 * - Card: 4111111111111111
 * - Expiry: Any future date (MM/YY)
 * - CVV: Any 3 digits
 * 
 * Production:
 * - Switch to live keys (rzp_live_) after testing
 * - DO NOT commit live keys to version control
 * - Rotate keys periodically
 */

const Razorpay = require('razorpay');

// Only initialize if keys are configured — prevents crash in local dev without Razorpay credentials
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn('⚠️  Razorpay keys not set — payment features disabled in this environment');
}

module.exports = razorpay;
