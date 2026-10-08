/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Simulator Engine: "What If" Analysis, Scenario Simulation & Digital Twin Nodes
 */

/**
 * Projects a day-by-day stock depletion timeline if no action is taken ("What Will Happen If We Do Nothing?").
 */
export function simulateDoNothingTimeline(
  medicineId,
  usableStock,
  dailyDemand,
  currentDateStr,
  maxDays = 30
) {
  const currentDate = new Date(currentDateStr);
  const timeline = [];
  let remainingStock = usableStock;
  let depletionDate = null;
  let daysUntilDepletion = maxDays;
  let totalUnmetDemand = 0;

  for (let i = 0; i <= maxDays; i++) {
    const dayDate = new Date(currentDate);
    dayDate.setDate(dayDate.getDate() + i);
    const dateStr = dayDate.toISOString().split('T')[0];

    const dayDemand = Math.round(dailyDemand);

    if (i > 0) {
      if (remainingStock >= dayDemand) {
        remainingStock -= dayDemand;
      } else {
        const unmet = dayDemand - remainingStock;
        totalUnmetDemand += unmet;
        remainingStock = 0;
        if (!depletionDate) {
          depletionDate = dateStr;
          daysUntilDepletion = i;
        }
      }
    }

    timeline.push({
      date: dateStr,
      dayOffset: i,
      projectedStock: remainingStock,
      projectedDemand: dayDemand,
      isDepleted: remainingStock === 0
    });
  }

  const potentialShortageDurationDays = depletionDate ? maxDays - daysUntilDepletion + 1 : 0;

  return {
    medicineId,
    timeline,
    depletionDate,
    daysUntilDepletion,
    potentialShortageDurationDays,
    expectedUnmetDemandUnits: totalUnmetDemand
  };
}

/**
 * Recalculates risk and reorder metrics under a user-defined scenario simulation.
 */
export function runScenarioSimulation(
  medicine,
  salesFeatures,
  inventoryFeatures,
  supplierFeatures,
  forecastResult,
  currentDateStr,
  scenarioInput = {}
) {
  const {
    demandMultiplier = 1.0, // e.g. 1.25 for +25%
    supplierDelayDays = 0, // e.g. +3 days
    incomingStockAdjustment = 0 // e.g. +100
  } = scenarioInput;

  // Adjusted daily demand
  const adjustedDailyDemand = Math.max(0.1, forecastResult.baseDailyDemand * demandMultiplier);

  // Adjusted usable stock
  const adjustedUsableStock = Math.max(0, inventoryFeatures.usableStock + incomingStockAdjustment);

  // Adjusted lead time
  const adjustedLeadTime = Math.max(1, supplierFeatures.leadTimeDays + supplierDelayDays);

  // Re-calculate days of stock
  const adjustedDaysOfStock = Number((adjustedUsableStock / adjustedDailyDemand).toFixed(1));

  // Expected depletion date
  const currentDate = new Date(currentDateStr);
  const depDate = new Date(currentDate);
  depDate.setDate(depDate.getDate() + Math.floor(adjustedDaysOfStock));

  // Risk Score
  let riskScore = 0;
  if (adjustedDaysOfStock === 0) riskScore = 100;
  else if (adjustedDaysOfStock <= adjustedLeadTime) riskScore = 88;
  else if (adjustedDaysOfStock <= adjustedLeadTime * 1.5) riskScore = 65;
  else if (adjustedDaysOfStock <= adjustedLeadTime * 2.5) riskScore = 35;
  else riskScore = 15;

  let riskLevel = 'LOW';
  if (riskScore >= 75 || adjustedDaysOfStock <= adjustedLeadTime) riskLevel = 'CRITICAL';
  else if (riskScore >= 55) riskLevel = 'HIGH';
  else if (riskScore >= 35) riskLevel = 'MODERATE';

  // Required reorder
  const forecast30d = Math.round(adjustedDailyDemand * 30);
  const safetyStock = Math.max(15, Math.ceil(forecast30d * 0.25));
  const leadTimeDemand = Math.ceil(adjustedDailyDemand * adjustedLeadTime);
  const reorderPoint = leadTimeDemand + safetyStock;
  const recommendedQuantity = Math.max(0, (forecast30d + safetyStock) - adjustedUsableStock);

  return {
    scenarioInput: {
      demandMultiplier,
      supplierDelayDays,
      incomingStockAdjustment
    },
    baseline: {
      daysOfStock: Number((inventoryFeatures.usableStock / forecastResult.baseDailyDemand).toFixed(1)),
      riskLevel: forecastResult.riskLevel || 'MODERATE',
      reorderPoint: leadTimeDemand + safetyStock
    },
    simulated: {
      adjustedDailyDemand: Number(adjustedDailyDemand.toFixed(2)),
      adjustedUsableStock,
      adjustedLeadTime,
      daysOfStock: adjustedDaysOfStock,
      expectedDepletionDate: depDate.toISOString().split('T')[0],
      riskLevel,
      riskScore,
      reorderPoint,
      recommendedQuantity
    }
  };
}

/**
 * Generates Supply Chain Digital Twin node states for visualization.
 */
export function getDigitalTwinState(medicines, inventory, suppliers, currentDateStr) {
  const totalStock = inventory.reduce((acc, i) => acc + (Number(i.currentQuantity) || 0), 0);
  const totalSuppliers = suppliers.length;
  const avgLeadTime = suppliers.length > 0 ? (suppliers.reduce((acc, s) => acc + (Number(s.deliveryTimeDays) || 7), 0) / suppliers.length).toFixed(1) : 7;

  return {
    nodes: [
      { id: 'supplier', label: 'Suppliers Network', count: totalSuppliers, status: 'Active', metric: `Avg Lead Time: ${avgLeadTime} days` },
      { id: 'shipment', label: 'Transit Pipeline', count: 3, status: 'In Transit', metric: '3 Active Orders' },
      { id: 'warehouse', label: 'Central Storage', count: inventory.length, status: 'Normal', metric: `${totalStock} Total Units` },
      { id: 'pharmacy', label: 'Pharmacy Rx Desk', count: medicines.length, status: 'Operational', metric: `${medicines.length} Formularies` },
      { id: 'patient', label: 'Patient Demand', count: 120, status: 'Active Signal', metric: 'Consuming Daily' }
    ],
    flows: [
      { from: 'supplier', to: 'shipment', active: true, latency: `${avgLeadTime}d` },
      { from: 'shipment', to: 'warehouse', active: true, latency: '1d' },
      { from: 'warehouse', to: 'pharmacy', active: true, latency: 'Same-day' },
      { from: 'pharmacy', to: 'patient', active: true, latency: 'Instant' }
    ],
    timestamp: currentDateStr
  };
}
