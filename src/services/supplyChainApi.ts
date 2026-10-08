/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Frontend Supply Chain API Service
 * Interacts with `/api/supply-chain/*` endpoints.
 */

import {
  SupplyChainOverviewSummary,
  SupplyRiskPrediction,
  DemandForecast,
  SupplierPerformance,
  ReorderRecommendation,
  ModelEvaluationMetric,
  ScenarioSimulationInput,
  WhatIfSimulationResult
} from '../types/supplyChain';

const API_BASE = '/api/supply-chain';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let message = `Request to ${path} failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const supplyChainApi = {
  getOverview: () => request<SupplyChainOverviewSummary>('/overview'),
  getRisks: (category?: string, riskLevel?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (riskLevel) params.append('riskLevel', riskLevel);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<Array<SupplyRiskPrediction & { medicineName: string; genericName: string; category: string; predictedDemand7Days: number; predictedDemand30Days: number }>>(`/risks${query}`);
  },
  getMedicineDetail: (medicineId: string) => request<any>(`/medicines/${medicineId}`),
  getForecast: (medicineId: string) => request<DemandForecast[]>(`/forecast/${medicineId}`),
  getSuppliers: () => request<SupplierPerformance[]>('/suppliers'),
  getRecommendations: () => request<Array<ReorderRecommendation & { medicineName: string; category: string }>>('/recommendations'),
  getEvaluation: () => request<any>('/evaluation'),
  getDigitalTwin: () => request<any>('/digital-twin'),
  runScenario: (payload: { medicineId: string } & ScenarioSimulationInput) =>
    request<any>('/scenario', { method: 'POST', body: JSON.stringify(payload) }),
  uploadHospitalDemand: (records: Array<{ date?: string; hospitalId?: string; hospitalName?: string; medicineId: string; quantityRequested: number }>) =>
    request<{ success: boolean; message: string; recordsCount: number }>('/hospital-demand/upload', {
      method: 'POST',
      body: JSON.stringify({ records })
    }),
  runPredictions: () => request<{ success: boolean; message: string; timestamp: string }>('/run-predictions', { method: 'POST' })
};

export default supplyChainApi;
