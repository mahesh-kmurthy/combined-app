// math.js

/**
 * Calculates the Extended Internal Rate of Return (XIRR).
 * @param {Array} cashflows Array of objects: { amount: number, date: Date }
 * @param {number} guess Initial guess for the rate (default 0.1)
 * @returns {number} The annualized rate of return (e.g. 0.15 for 15%)
 */
export function xirr(cashflows, guess = 0.1) {
  if (!cashflows || cashflows.length === 0) return 0;
  
  // Sort cashflows by date
  const sorted = [...cashflows].sort((a, b) => a.date - b.date);
  
  // Check if we have both positive and negative cashflows
  let hasPositive = false;
  let hasNegative = false;
  for (let cf of sorted) {
    if (cf.amount > 0) hasPositive = true;
    if (cf.amount < 0) hasNegative = true;
  }
  
  if (!hasPositive || !hasNegative) {
    return 0; // Infinite or zero return
  }

  const t0 = sorted[0].date;
  
  // Helper functions
  // Enforce at least artificial 1-day timeframe so 0-day trades don't explode to infinity
  const yearsOffset = (date) => Math.max(1/365, (date - t0) / (1000 * 60 * 60 * 24 * 365));
  
  const npv = (rate) => {
    // Math.pow(x, y) returns NaN if x is negative and y is fractional.
    // XIRR rate cannot theoretically be below -100% anyway.
    const r = Math.max(rate, -0.9999);
    return sorted.reduce((acc, cf) => {
      return acc + (cf.amount / Math.pow(1 + r, yearsOffset(cf.date)));
    }, 0);
  };
  
  const dNpv = (rate) => {
    const r = Math.max(rate, -0.9999);
    return sorted.reduce((acc, cf) => {
      const t = yearsOffset(cf.date);
      return acc - (cf.amount * t * Math.pow(1 + r, -t - 1));
    }, 0);
  };

  // Newton-Raphson
  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-6;
  
  for (let i = 0; i < maxIterations; i++) {
    const currentNpv = npv(rate);
    if (Math.abs(currentNpv) < tolerance) {
      break;
    }
    const derivative = dNpv(rate);
    if (derivative === 0) break; // avoid division by zero
    
    rate = rate - (currentNpv / derivative);
  }
  
  // If it didn't converge perfectly, return best attempt or fallback
  // In personal finance apps, a bounds check is often helpful because XIRR can blow up.
  if (rate < -0.999) return -0.999; // Cap at near -100% loss
  if (rate > 100) return 100; // Cap at +10,000% maximum so UX strings don't overlap 
  return rate;
}
