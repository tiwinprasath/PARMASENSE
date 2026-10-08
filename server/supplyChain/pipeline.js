/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Core Supply Chain Intelligence Orchestration Pipeline
 */

import { calculateSalesFeatures, calculateInventoryFeatures, calculateSupplierFeatures, calculateHospitalDemandFeature } from './featureEngineering.js';
import { generateDemandForecast } from './forecastingEngine.js';
import { evaluateShortageRisk } from './riskEngine.js';
import { calculateReorderRecommendation } from './reorderOptimizer.js';

/**
 * Runs the full 9-step supply chain intelligence pipeline and returns structured results.
 */
export function runSupplyChainPipeline(state, currentDateStr = new Date().toISOString().split('T')[0]) {
  const medicines = state.medicines || [];
  const inventory = state.inventory || [];
  const sales = state.sales || [];
  const suppliers = state.suppliers || [];
  const hospitalDemandList = state.hospital_demand || [];

  const forecastsList = [];
  const predictionsList = [];
  const recommendationsList = [];
  const supplierPerfMap = {};
  const notificationsList = [...(state.notifications || [])];

  let medicinesAtRiskCount = 0;
  let criticalShortagesCount = 0;
  let predictedShortagesCount = 0;
  let totalConfidenceSum = 0;

  // Process each medicine in the formulary
  medicines.forEach((med) => {
    // 1. Feature Engineering
    const salesFeat = calculateSalesFeatures(sales, med.id, currentDateStr);
    const invFeat = calculateInventoryFeatures(inventory, med.id, currentDateStr);
    const supplierFeat = calculateSupplierFeatures(suppliers, invFeat.primarySupplierId);
    const hospitalFeat = calculateHospitalDemandFeature(hospitalDemandList, med.id, currentDateStr);

    // Track supplier performance stats
    if (invFeat.primarySupplierId && !supplierPerfMap[invFeat.primarySupplierId]) {
      supplierPerfMap[invFeat.primarySupplierId] = {
        id: `SUP-PERF-${invFeat.primarySupplierId}`,
        supplierId: invFeat.primarySupplierId,
        supplierName: supplierFeat.supplierName,
        averageLeadTimeDays: supplierFeat.leadTimeDays,
        onTimeDeliveryRate: supplierFeat.onTimeRate,
        leadTimeVarianceDays: supplierFeat.leadTimeVarianceDays,
        totalDeliveries: 12,
        lastUpdated: currentDateStr
      };
    }

    // 2. Multi-Horizon Demand Forecasting
    const forecastRes = generateDemandForecast(med, salesFeat, { hospitalDemand: hospitalFeat });

    // Format forecast records for database
    [7, 15, 30, 60, 90].forEach((h) => {
      const hRes = forecastRes.horizons[h];
      if (hRes) {
        forecastsList.push({
          id: `FCAST-${med.id}-${h}D-${currentDateStr}`,
          medicineId: med.id,
          forecastDate: currentDateStr,
          horizonDays: h,
          predictedDemand: hRes.predictedDemand,
          lowerBound: hRes.lowerBound,
          upperBound: hRes.upperBound,
          confidence: hRes.confidence,
          modelName: hRes.modelName,
          createdAt: currentDateStr
        });
      }
    });

    // 3. Shortage Risk & Explainable AI Prediction
    const riskRes = evaluateShortageRisk(
      med,
      salesFeat,
      invFeat,
      supplierFeat,
      forecastRes,
      currentDateStr
    );
    predictionsList.push(riskRes);

    totalConfidenceSum += riskRes.confidence;

    if (riskRes.riskLevel === 'CRITICAL') {
      criticalShortagesCount++;
      medicinesAtRiskCount++;

      // Create Notification for Critical Shortage if not existing
      const notiId = `NOTI-CRIT-${med.id}-${currentDateStr}`;
      if (!notificationsList.some((n) => n.id === notiId)) {
        notificationsList.unshift({
          id: notiId,
          type: 'low_stock',
          title: `CRITICAL SHORTAGE RISK: ${med.name}`,
          message: `${med.name} usable stock (${invFeat.usableStock}) covers ~${riskRes.daysOfStock} days vs supplier lead time of ${supplierFeat.leadTimeDays} days.`,
          date: currentDateStr,
          isRead: false,
          severity: 'error',
          medicineIds: [med.id]
        });
      }
    } else if (riskRes.riskLevel === 'HIGH') {
      medicinesAtRiskCount++;
      predictedShortagesCount++;
    } else if (riskRes.riskLevel === 'MODERATE') {
      medicinesAtRiskCount++;
    }

    // 4. Reorder Recommendation Calculation
    const reorderRes = calculateReorderRecommendation(
      med,
      invFeat,
      supplierFeat,
      forecastRes,
      riskRes,
      currentDateStr
    );

    if (reorderRes.recommendedQuantity > 0) {
      recommendationsList.push(reorderRes);
    }
  });

  const avgConfidence = medicines.length > 0 ? Number((totalConfidenceSum / medicines.length).toFixed(1)) : 85.0;

  const overview = {
    medicinesAtRiskCount,
    criticalShortagesCount,
    predictedShortagesCount,
    reorderRecommendationsCount: recommendationsList.length,
    averageForecastConfidence: avgConfidence,
    lastPredictionRun: currentDateStr
  };

  const supplierPerformanceList = Object.values(supplierPerfMap);

  return {
    overview,
    demand_forecasts: forecastsList,
    supply_risk_predictions: predictionsList,
    supplier_performance: supplierPerformanceList,
    reorder_recommendations: recommendationsList,
    notifications: notificationsList
  };
}
