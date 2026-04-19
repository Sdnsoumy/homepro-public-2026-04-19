/**
 * Smart Seasonal Recommendations
 * 
 * Recommends service categories based on current month/season
 * Tailored for Indian climate and seasonal needs:
 * - Summer (Mar-May): AC & electrical issues peak
 * - Monsoon (Jun-Aug): Plumbing & waterproofing critical
 * - Post-monsoon (Sep-Oct): Cleanup and repairs
 * - Winter (Nov-Feb): Painting and general maintenance
 */

// Month numbers are 0-indexed from JavaScript's Date.getMonth()
// 0 = January, 11 = December
const SEASONAL_RECOMMENDATIONS = {
  0:  ['AC Repair', 'Home Cleaning'],           // January  — post-winter cleaning, mild AC needs
  1:  ['Painter', 'Home Cleaning'],              // February — pre-summer freshening, painting season
  2:  ['AC Repair', 'Electrician'],              // March    — summer prep, check AC & wiring
  3:  ['AC Repair', 'Electrician'],              // April    — peak summer demand
  4:  ['AC Repair', 'Plumber'],                  // May      — peak summer, check water systems
  5:  ['Plumber', 'Carpenter'],                  // June     — monsoon prep, waterproofing
  6:  ['Plumber', 'Carpenter', 'Electrician'],   // July     — monsoon peak, leaks & electrical risks
  7:  ['Plumber', 'Carpenter'],                  // August   — monsoon continues, drainage issues
  8:  ['Home Cleaning', 'Painter'],              // September — post-monsoon cleanup & drying
  9:  ['Home Cleaning', 'Electrician'],          // October  — festival season (Diwali) prep
  10: ['Electrician', 'Painter'],                // November — post-festival repairs, festival lighting
  11: ['Home Cleaning', 'AC Repair'],            // December — year-end deep clean, holiday prep
};

/**
 * Get recommended service categories for current month
 * Returns array of 2-3 category names based on seasonal demand
 */
const getRecommendations = () => {
  const currentMonth = new Date().getMonth();
  return SEASONAL_RECOMMENDATIONS[currentMonth] || [];
};

module.exports = { getRecommendations };
