/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Transparent Shortage Risk Engine & Explainable AI Generator
 */

// Configurable factor weights (can be tuned or set via admin config)
export const DEFAULT_RISK_WEIGHTS = {
  stockCoverage: 35, // Stock coverage below supplier lead time
  demandGrowth: 25, // Accelerating demand
  supplierUnreliability: 15, // Poor lead time or delivery score
  expiryImpact: 10, // Stock expiring soon
  forecastUncertainty: 10, // High variance / low historical data
  externalSignals: 5 // Weather or health trend spikes
};

/**
 * Calculates shortage risk, depletion date, and explainable AI factors.
 */
export function evaluateShortageRisk(
  medicine,
  salesFeatures,
  inventoryFeatures,
  supplierFeatures,
  forecastResult,
  currentDateStr,
  customWeights = DEFAULT_RISK_WEIGHTS
) {
  const currentDate = new Date(currentDateStr);
  const { usableStock, currentStock, expiringSoon30d } = inventoryFeatures;
  const { dailyDemand30d, growth7d, growth30d, demandVolatilityPercent } = salesFeatures;
  const { leadTimeDays, onTimeRate, supplierName } = supplierFeatures;
  const { baseDailyDemand, overallConfidence } = forecastResult;

  const weights = { ...DEFAULT_RISK_WEIGHTS, ...customWeights };

  // 1. Calculate Days of Stock Remaining
  const effectiveDailyDemand = Math.max(0.05, baseDailyDemand);
  const daysOfStock = Number((usableStock / effectiveDailyDemand).toFixed(1));

  // 2. Calculate Expected Depletion Date
  const depletionDate = new Date(currentDate);
  depletionDate.setDate(depletionDate.getDate() + Math.floor(daysOfStock));
  const expectedDepletionDate = depletionDate.toISOString().split('T')[0];

  // 3. Compare Depletion Date vs Supplier Lead Time
  const isLeadTimeAtRisk = daysOfStock <= leadTimeDays;

  // 4. Transparent Risk Scoring (0 to 100)
  let riskScore = 0;
  const contributingFactors = [];

  // Factor A: Stock Coverage vs Supplier Lead Time (Weight ~35%)
  let coverageScore = 0;
  if (daysOfStock === 0) {
    coverageScore = 100;
  } else if (daysOfStock <= leadTimeDays) {
    coverageScore = 90;
  } else if (daysOfStock <= leadTimeDays * 1.5) {
    coverageScore = 65;
  } else if (daysOfStock <= leadTimeDays * 2.5) {
    coverageScore = 35;
  } else {
    coverageScore = 10;
  }
  const coverageContrib = (coverageScore * weights.stockCoverage) / 100;
  riskScore += coverageContrib;
  contributingFactors.push({
    factor: 'Stock Coverage',
    weight: weights.stockCoverage,
    impact: coverageScore > 50 ? 'negative' : 'positive',
    scoreContribution: Number(coverageContrib.toFixed(1)),
    description: `Current usable stock (${usableStock} units) covers ~${daysOfStock} days vs supplier lead time of ${leadTimeDays} days.`
  });

  // Factor B: Demand Growth (Weight ~25%)
  let demandGrowthScore = 0;
  if (growth7d > 40) demandGrowthScore = 90;
  else if (growth7d > 20) demandGrowthScore = 70;
  else if (growth7d > 0) demandGrowthScore = 40;
  else demandGrowthScore = 10;
  const growthContrib = (demandGrowthScore * weights.demandGrowth) / 100;
  riskScore += growthContrib;
  contributingFactors.push({
    factor: 'Demand Growth Acceleration',
    weight: weights.demandGrowth,
    impact: growth7d > 15 ? 'negative' : 'positive',
    scoreContribution: Number(growthContrib.toFixed(1)),
    description: `7-day demand increased by ${growth7d > 0 ? '+' : ''}${growth7d}% over the previous period.`
  });

  // Factor C: Supplier Reliability & Lead Time (Weight ~15%)
  let supplierScore = (100 - onTimeRate) + (leadTimeDays > 10 ? 25 : 0);
  supplierScore = Math.min(100, Math.max(0, supplierScore));
  const supplierContrib = (supplierScore * weights.supplierUnreliability) / 100;
  riskScore += supplierContrib;
  contributingFactors.push({
    factor: 'Supplier Reliability',
    weight: weights.supplierUnreliability,
    impact: onTimeRate < 85 ? 'negative' : 'positive',
    scoreContribution: Number(supplierContrib.toFixed(1)),
    description: `Supplier "${supplierName}" has an on-time rate of ${onTimeRate}% with ${leadTimeDays} days lead time.`
  });

  // Factor D: Impending Expiry Impact (Weight ~10%)
  let expiryScore = currentStock > 0 ? (expiringSoon30d / currentStock) * 100 : 0;
  expiryScore = Math.min(100, expiryScore);
  const expiryContrib = (expiryScore * weights.expiryImpact) / 100;
  riskScore += expiryContrib;
  if (expiringSoon30d > 0) {
    contributingFactors.push({
      factor: 'Impending Stock Expiry',
      weight: weights.expiryImpact,
      impact: 'negative',
      scoreContribution: Number(expiryContrib.toFixed(1)),
      description: `${expiringSoon30d} units of total stock are expiring within 30 days.`
    });
  }

  // Factor E: Forecast Uncertainty (Weight ~10%)
  const uncertaintyScore = Math.max(0, 100 - overallConfidence);
  const uncertaintyContrib = (uncertaintyScore * weights.forecastUncertainty) / 100;
  riskScore += uncertaintyContrib;
  contributingFactors.push({
    factor: 'Forecast Uncertainty',
    weight: weights.forecastUncertainty,
    impact: overallConfidence < 75 ? 'negative' : 'neutral',
    scoreContribution: Number(uncertaintyContrib.toFixed(1)),
    description: `Prediction confidence is ${overallConfidence}% based on historical sales variance.`
  });

  // Cap final risk score between 0 and 100
  riskScore = Number(Math.min(100, Math.max(0, riskScore)).toFixed(1));

  // 5. Assign Risk Level Category
  let riskLevel = 'LOW';
  if (riskScore >= 75 || daysOfStock <= leadTimeDays) {
    riskLevel = 'CRITICAL';
  } else if (riskScore >= 55 || daysOfStock <= leadTimeDays * 1.5) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 35 || daysOfStock <= leadTimeDays * 2.5) {
    riskLevel = 'MODERATE';
  }

  // 6. Generate Human-Readable Explainable AI (XAI) Panel Content
  const whyReasons = [];
  if (growth7d !== 0) {
    whyReasons.push(`Demand ${growth7d > 0 ? 'increased' : 'decreased'} by ${Math.abs(growth7d)}% compared to previous 7-day period.`);
  }
  whyReasons.push(`Usable stock (${usableStock} units) covers approximately ${daysOfStock} days.`);
  whyReasons.push(`Supplier average delivery lead time is ${leadTimeDays} days (${onTimeRate}% on-time rate).`);
  if (forecastResult.horizons[30] && forecastResult.horizons[30].predictedDemand > usableStock) {
    whyReasons.push(`30-day forecast (${forecastResult.horizons[30].predictedDemand} units) exceeds currently available usable stock.`);
  }
  if (expiringSoon30d > 0) {
    whyReasons.push(`${expiringSoon30d} units will expire within 30 days and were discounted from usable stock.`);
  }
  whyReasons.push(`Model confidence score is ${overallConfidence}%.`);

  const reviewDate = new Date(currentDate);
  reviewDate.setDate(reviewDate.getDate() + Math.max(1, Math.floor(daysOfStock - leadTimeDays)));
  const suggestedReviewDateStr = reviewDate.toISOString().split('T')[0];

  const explanation = {
    what: riskLevel === 'CRITICAL' ? 'CRITICAL SHORTAGE RISK' : riskLevel === 'HIGH' ? 'HIGH SHORTAGE RISK' : riskLevel === 'MODERATE' ? 'MODERATE SHORTAGE RISK' : 'LOW SHORTAGE RISK',
    when: `Expected stock depletion: ${expectedDepletionDate}`,
    why: whyReasons,
    recommendation: `Recommended for review: Consider initiating stock replenishment before ${suggestedReviewDateStr}.`
  };

  return {
    medicineId: medicine.id,
    predictionDate: currentDateStr,
    riskLevel,
    riskScore,
    daysOfStock,
    expectedDepletionDate,
    supplierLeadTimeDays: leadTimeDays,
    isLeadTimeAtRisk,
    confidence: overallConfidence,
    contributingFactors,
    explanation,
    lastUpdated: currentDateStr
  };
}
