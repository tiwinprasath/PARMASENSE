/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Express REST API Routes for Supply Chain Intelligence Module
 */

import express from 'express';
import db from '../db.js';
import { runSupplyChainPipeline } from './pipeline.js';
import { simulateDoNothingTimeline, runScenarioSimulation, getDigitalTwinState } from './simulator.js';
import { evaluateForecastingModels } from './evaluation.js';
import { calculateSalesFeatures, calculateInventoryFeatures, calculateSupplierFeatures, calculateHospitalDemandFeature } from './featureEngineering.js';
import { generateDemandForecast } from './forecastingEngine.js';

const router = express.Router();

// Helper to get or run supply chain predictions
function getOrRunPipeline(forceRefresh = false) {
  const state = db.readState();
  const currentDateStr = new Date().toISOString().split('T')[0];

  const existingPredictions = state.supply_risk_predictions || [];
  if (!forceRefresh && existingPredictions.length > 0) {
    // Check if predictions exist for current date
    const isFresh = existingPredictions.some((p) => p.predictionDate === currentDateStr);
    if (isFresh) {
      return {
        state,
        pipelineResult: {
          demand_forecasts: state.demand_forecasts || [],
          supply_risk_predictions: state.supply_risk_predictions || [],
          supplier_performance: state.supplier_performance || [],
          reorder_recommendations: state.reorder_recommendations || [],
          notifications: state.notifications || []
        }
      };
    }
  }

  // Run pipeline and write results to DB
  const pipelineResult = runSupplyChainPipeline(state, currentDateStr);

  state.demand_forecasts = pipelineResult.demand_forecasts;
  state.supply_risk_predictions = pipelineResult.supply_risk_predictions;
  state.supplier_performance = pipelineResult.supplier_performance;
  state.reorder_recommendations = pipelineResult.reorder_recommendations;
  state.notifications = pipelineResult.notifications;

  db.writeState(state);

  return { state, pipelineResult };
}

// 1. GET /api/supply-chain/overview
router.get('/overview', (_req, res) => {
  try {
    const { state } = getOrRunPipeline();
    const predictions = state.supply_risk_predictions || [];
    const recommendations = state.reorder_recommendations || [];

    const criticalCount = predictions.filter((p) => p.riskLevel === 'CRITICAL').length;
    const highCount = predictions.filter((p) => p.riskLevel === 'HIGH').length;
    const moderateCount = predictions.filter((p) => p.riskLevel === 'MODERATE').length;
    const atRiskCount = criticalCount + highCount + moderateCount;

    const avgConfidence = predictions.length > 0
      ? Number((predictions.reduce((acc, p) => acc + p.confidence, 0) / predictions.length).toFixed(1))
      : 85.0;

    res.json({
      medicinesAtRiskCount: atRiskCount,
      criticalShortagesCount: criticalCount,
      predictedShortagesCount: highCount,
      reorderRecommendationsCount: recommendations.length,
      averageForecastConfidence: avgConfidence,
      lastPredictionRun: new Date().toISOString().split('T')[0]
    });
  } catch (err) {
    console.error('[supply-chain/overview] Error:', err);
    res.status(500).json({ error: 'Failed to compute supply chain overview' });
  }
});

// 2. GET /api/supply-chain/risks
router.get('/risks', (req, res) => {
  try {
    const { state } = getOrRunPipeline();
    let predictions = state.supply_risk_predictions || [];
    const medicines = state.medicines || [];

    // Combine prediction object with medicine metadata
    let enriched = predictions.map((p) => {
      const med = medicines.find((m) => m.id === p.medicineId);
      const forecasts = (state.demand_forecasts || []).filter((f) => f.medicineId === p.medicineId);
      const f7 = forecasts.find((f) => f.horizonDays === 7)?.predictedDemand || 0;
      const f30 = forecasts.find((f) => f.horizonDays === 30)?.predictedDemand || 0;

      return {
        ...p,
        medicineName: med ? med.name : 'Unknown Medicine',
        genericName: med ? med.genericName : '',
        category: med ? med.category : 'General',
        predictedDemand7Days: f7,
        predictedDemand30Days: f30
      };
    });

    // Optional query filtering
    if (req.query.riskLevel) {
      enriched = enriched.filter((p) => p.riskLevel === String(req.query.riskLevel).toUpperCase());
    }
    if (req.query.category && req.query.category !== 'All') {
      enriched = enriched.filter((p) => p.category === req.query.category);
    }

    res.json(enriched);
  } catch (err) {
    console.error('[supply-chain/risks] Error:', err);
    res.status(500).json({ error: 'Failed to fetch shortage risks' });
  }
});

// 3. GET /api/supply-chain/medicines/:id
router.get('/medicines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { state } = getOrRunPipeline();
    const currentDateStr = new Date().toISOString().split('T')[0];

    const medicine = (state.medicines || []).find((m) => m.id === id);
    if (!medicine) {
      return res.status(404).json({ error: `Medicine with ID ${id} not found.` });
    }

    const prediction = (state.supply_risk_predictions || []).find((p) => p.medicineId === id);
    const forecasts = (state.demand_forecasts || []).filter((f) => f.medicineId === id);
    const recommendation = (state.reorder_recommendations || []).find((r) => r.medicineId === id);

    const salesFeat = calculateSalesFeatures(state.sales, id, currentDateStr);
    const invFeat = calculateInventoryFeatures(state.inventory, id, currentDateStr);
    const supplierFeat = calculateSupplierFeatures(state.suppliers, invFeat.primarySupplierId);
    const hospitalFeat = calculateHospitalDemandFeature(state.hospital_demand, id, currentDateStr);

    const doNothingSimulation = simulateDoNothingTimeline(
      id,
      invFeat.usableStock,
      salesFeat.dailyDemand30d,
      currentDateStr,
      30
    );

    res.json({
      medicine,
      salesFeatures: salesFeat,
      inventoryFeatures: invFeat,
      supplierFeatures: supplierFeat,
      hospitalFeatures: hospitalFeat,
      prediction,
      forecasts,
      recommendation,
      doNothingSimulation
    });
  } catch (err) {
    console.error('[supply-chain/medicines/:id] Error:', err);
    res.status(500).json({ error: 'Failed to fetch medicine detail' });
  }
});

// 4. GET /api/supply-chain/forecast/:id
router.get('/forecast/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { state } = getOrRunPipeline();
    const forecasts = (state.demand_forecasts || []).filter((f) => f.medicineId === id);
    res.json(forecasts);
  } catch (err) {
    console.error('[supply-chain/forecast/:id] Error:', err);
    res.status(500).json({ error: 'Failed to fetch demand forecasts' });
  }
});

// 5. GET /api/supply-chain/suppliers
router.get('/suppliers', (_req, res) => {
  try {
    const { state } = getOrRunPipeline();
    res.json(state.supplier_performance || []);
  } catch (err) {
    console.error('[supply-chain/suppliers] Error:', err);
    res.status(500).json({ error: 'Failed to fetch supplier performance' });
  }
});

// 6. GET /api/supply-chain/recommendations
router.get('/recommendations', (_req, res) => {
  try {
    const { state } = getOrRunPipeline();
    const recommendations = state.reorder_recommendations || [];
    const medicines = state.medicines || [];

    const enriched = recommendations.map((r) => {
      const med = medicines.find((m) => m.id === r.medicineId);
      return {
        ...r,
        medicineName: med ? med.name : 'Unknown Medicine',
        category: med ? med.category : 'General'
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[supply-chain/recommendations] Error:', err);
    res.status(500).json({ error: 'Failed to fetch reorder recommendations' });
  }
});

// 7. GET /api/supply-chain/evaluation
router.get('/evaluation', (_req, res) => {
  try {
    const state = db.readState();
    const currentDateStr = new Date().toISOString().split('T')[0];
    const evaluation = evaluateForecastingModels(state.medicines, state.sales, state.inventory, currentDateStr);
    res.json(evaluation);
  } catch (err) {
    console.error('[supply-chain/evaluation] Error:', err);
    res.status(500).json({ error: 'Failed to compute model evaluation' });
  }
});

// 8. GET /api/supply-chain/digital-twin
router.get('/digital-twin', (_req, res) => {
  try {
    const state = db.readState();
    const currentDateStr = new Date().toISOString().split('T')[0];
    const twinState = getDigitalTwinState(state.medicines, state.inventory, state.suppliers, currentDateStr);
    res.json(twinState);
  } catch (err) {
    console.error('[supply-chain/digital-twin] Error:', err);
    res.status(500).json({ error: 'Failed to fetch digital twin simulation' });
  }
});

// 9. POST /api/supply-chain/scenario
router.post('/scenario', (req, res) => {
  try {
    const { medicineId, demandMultiplier = 1.0, supplierDelayDays = 0, incomingStockAdjustment = 0 } = req.body || {};
    if (!medicineId) {
      return res.status(400).json({ error: 'medicineId is required' });
    }

    const state = db.readState();
    const currentDateStr = new Date().toISOString().split('T')[0];
    const med = (state.medicines || []).find((m) => m.id === medicineId);
    if (!med) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const salesFeat = calculateSalesFeatures(state.sales, medicineId, currentDateStr);
    const invFeat = calculateInventoryFeatures(state.inventory, medicineId, currentDateStr);
    const supplierFeat = calculateSupplierFeatures(state.suppliers, invFeat.primarySupplierId);
    const forecastRes = generateDemandForecast(med, salesFeat);

    const simulation = runScenarioSimulation(
      med,
      salesFeat,
      invFeat,
      supplierFeat,
      forecastRes,
      currentDateStr,
      { demandMultiplier, supplierDelayDays, incomingStockAdjustment }
    );

    res.json(simulation);
  } catch (err) {
    console.error('[supply-chain/scenario] Error:', err);
    res.status(500).json({ error: 'Failed to execute scenario simulation' });
  }
});

// 10. POST /api/supply-chain/hospital-demand/upload
router.post('/hospital-demand/upload', (req, res) => {
  try {
    const { records = [] } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Payload must contain a non-empty array of hospital records' });
    }

    const state = db.readState();
    const existing = state.hospital_demand || [];
    const formatted = records.map((r, index) => ({
      id: `HOSP-${Date.now()}-${index}`,
      date: r.date || new Date().toISOString().split('T')[0],
      hospitalId: r.hospitalId || 'H001',
      hospitalName: r.hospitalName || 'City General Hospital',
      medicineId: r.medicineId,
      quantityRequested: Number(r.quantityRequested) || 0,
      status: r.status || 'Pending'
    }));

    state.hospital_demand = [...formatted, ...existing];
    db.writeState(state);

    // Re-run pipeline to incorporate new hospital signal
    getOrRunPipeline(true);

    res.json({
      success: true,
      message: `Successfully uploaded ${records.length} hospital demand records.`,
      recordsCount: records.length
    });
  } catch (err) {
    console.error('[supply-chain/hospital-demand/upload] Error:', err);
    res.status(500).json({ error: 'Failed to process hospital demand upload' });
  }
});

// 11. POST /api/supply-chain/run-predictions or retrain
router.post(['/run-predictions', '/retrain'], (_req, res) => {
  try {
    const { pipelineResult } = getOrRunPipeline(true);
    res.json({
      success: true,
      message: 'Supply Chain Intelligence predictions enqueued and computed successfully.',
      timestamp: new Date().toISOString(),
      predictionsCount: pipelineResult.supply_risk_predictions.length,
      recommendationsCount: pipelineResult.reorder_recommendations.length
    });
  } catch (err) {
    console.error('[supply-chain/run-predictions] Error:', err);
    res.status(500).json({ error: 'Failed to execute prediction pipeline' });
  }
});

export default router;
