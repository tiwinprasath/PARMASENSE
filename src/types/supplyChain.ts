/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Types for Medicine Supply Chain Intelligence Module
 */

import { MedicineMaster, InventoryItem, Sale, Supplier } from '../types';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface DemandForecast {
  id: string;
  medicineId: string;
  forecastDate: string; // YYYY-MM-DD
  horizonDays: 7 | 15 | 30 | 60 | 90;
  predictedDemand: number;
  lowerBound: number;
  upperBound: number;
  confidence: number; // e.g. 85.5%
  modelName: string; // e.g. "Weighted Moving Average", "Statistical Regression", "XGBoost-Sim"
  createdAt: string;
}

export interface RiskFactor {
  factor: string;
  weight: number;
  impact: 'positive' | 'negative' | 'neutral';
  scoreContribution: number;
  description: string;
}

export interface SupplyRiskPrediction {
  id: string;
  medicineId: string;
  predictionDate: string; // YYYY-MM-DD
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100
  daysOfStock: number;
  expectedDepletionDate: string; // YYYY-MM-DD
  supplierLeadTimeDays: number;
  isLeadTimeAtRisk: boolean;
  confidence: number;
  contributingFactors: RiskFactor[];
  explanation: {
    what: string;
    when: string;
    why: string[];
    recommendation: string;
  };
  lastUpdated: string;
}

export interface SupplierPerformance {
  id: string;
  supplierId: string;
  supplierName: string;
  medicineId?: string;
  averageLeadTimeDays: number;
  onTimeDeliveryRate: number; // 0 - 100%
  leadTimeVarianceDays: number;
  totalDeliveries: number;
  lastUpdated: string;
}

export interface ReorderRecommendation {
  id: string;
  medicineId: string;
  recommendedDate: string; // YYYY-MM-DD
  recommendedQuantity: number;
  reorderPoint: number;
  safetyStock: number;
  currentStock: number;
  usableStock: number;
  expiringStock30d: number;
  incomingStock: number;
  forecast30d: number;
  reason: string;
  confidence: number;
  status: 'Recommended for Review' | 'Order Placed' | 'Dismissed';
  createdAt: string;
}

export interface HospitalDemandRecord {
  id: string;
  date: string; // YYYY-MM-DD
  hospitalId: string;
  hospitalName: string;
  medicineId: string;
  quantityRequested: number;
  status: 'Fulfilled' | 'Pending' | 'Urgent';
  region?: string;
}

export interface WeatherSignal {
  location: string;
  temperatureCelsius: number;
  rainfallMm: number;
  humidityPercent: number;
  condition: 'Sunny' | 'Rainy' | 'Cold' | 'Humid' | 'Overcast';
  influenceLevel: 'Low' | 'Moderate' | 'High';
  relevanceExplanation: string;
}

export interface DiseaseTrendSignal {
  region: string;
  trendName: string;
  changePercent: number; // e.g. +18
  diseaseCategory: string;
  affectedMedicineCategories: string[];
  impactLevel: 'Low' | 'Moderate' | 'High';
  source: string;
}

export interface ExternalSignalsPayload {
  weather?: WeatherSignal;
  diseaseTrends?: DiseaseTrendSignal[];
  hospitalDemandSummary?: {
    totalRequests30d: number;
    topMedicineId?: string;
    trend: 'Increasing' | 'Stable' | 'Decreasing';
  };
}

export interface ModelEvaluationMetric {
  modelName: string;
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  mape: number; // Mean Absolute Percentage Error
  wape: number; // Weighted Absolute Percentage Error
  shortagePrecision: number; // %
  shortageRecall: number; // %
  falseAlarmRate: number; // %
  evaluatedSampleCount: number;
}

export interface WhatIfSimulationResult {
  medicineId: string;
  timeline: Array<{
    date: string;
    dayOffset: number;
    projectedStock: number;
    projectedDemand: number;
    isDepleted: boolean;
  }>;
  depletionDate: string | null;
  daysUntilDepletion: number;
  potentialShortageDurationDays: number;
  expectedUnmetDemandUnits: number;
}

export interface ScenarioSimulationInput {
  demandMultiplier: number; // e.g. 1.25 for +25%
  supplierDelayDays: number; // e.g. +3 days
  incomingStockAdjustment: number; // e.g. +100 or -100
}

export interface SupplyChainOverviewSummary {
  medicinesAtRiskCount: number;
  criticalShortagesCount: number;
  predictedShortagesCount: number;
  reorderRecommendationsCount: number;
  averageForecastConfidence: number;
  lastPredictionRun: string;
}
