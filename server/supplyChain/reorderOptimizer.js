/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reorder Recommendation & Optimization Engine
 */

/**
 * Computes reorder point and recommended purchase quantity for a medicine.
 */
export function calculateReorderRecommendation(
  medicine,
  inventoryFeatures,
  supplierFeatures,
  forecastResult,
  riskPrediction,
  currentDateStr
) {
  const currentDate = new Date(currentDateStr);
  const { currentStock, usableStock, expiringSoon30d } = inventoryFeatures;
  const { leadTimeDays } = supplierFeatures;
  const { baseDailyDemand, overallConfidence } = forecastResult;

  // 1. Demand during Lead Time
  const leadTimeDemand = Math.ceil(baseDailyDemand * leadTimeDays);

  // 2. Safety Stock Buffer (accounts for lead time variance & demand volatility)
  // Safety Stock = z * stdDev * sqrt(leadTime), approximated as ~25% of 30-day demand or min 20 units
  const forecast30d = forecastResult.horizons[30] ? forecastResult.horizons[30].predictedDemand : Math.round(baseDailyDemand * 30);
  const safetyStock = Math.max(15, Math.ceil(forecast30d * 0.25));

  // 3. Reorder Point (ROP) = Lead Time Demand + Safety Stock
  const reorderPoint = leadTimeDemand + safetyStock;

  // 4. Recommended Order Quantity Calculation
  // Target inventory level = 30-day forecast + Safety Stock
  // Recommended Order = Target Level - Usable Stock
  const targetInventoryLevel = forecast30d + safetyStock;
  let recommendedQuantity = targetInventoryLevel - usableStock;

  // Ensure reasonable minimum order increment
  recommendedQuantity = Math.max(0, Math.ceil(recommendedQuantity));

  // If usable stock is already above ROP, no immediate order is strictly required
  if (usableStock > reorderPoint && recommendedQuantity < 10) {
    recommendedQuantity = 0;
  } else if (recommendedQuantity > 0) {
    // Round to standard package batch sizes (e.g. nearest 10 or 50)
    if (recommendedQuantity < 50) {
      recommendedQuantity = Math.ceil(recommendedQuantity / 5) * 5;
    } else {
      recommendedQuantity = Math.ceil(recommendedQuantity / 10) * 10;
    }
  }

  // Recommended date for reorder
  const daysUntilOrder = Math.max(0, Math.floor((usableStock - leadTimeDemand) / Math.max(0.1, baseDailyDemand)));
  const orderDate = new Date(currentDate);
  orderDate.setDate(orderDate.getDate() + daysUntilOrder);
  const recommendedDateStr = orderDate.toISOString().split('T')[0];

  const reason = `Current usable stock (${usableStock} units) vs Reorder Point of ${reorderPoint} units (Lead time demand: ${leadTimeDemand} + Safety stock: ${safetyStock}). 30-day forecast is ${forecast30d} units.`;

  return {
    id: `REORDER-${medicine.id}-${currentDateStr}`,
    medicineId: medicine.id,
    recommendedDate: recommendedDateStr,
    recommendedQuantity,
    reorderPoint,
    safetyStock,
    currentStock,
    usableStock,
    expiringStock30d: expiringSoon30d,
    incomingStock: 0,
    forecast30d,
    reason,
    confidence: overallConfidence,
    status: 'Recommended for Review',
    createdAt: currentDateStr
  };
}
