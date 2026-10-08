/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Detailed Medicine Supply Risk & Explainable AI View Component
 */

import React, { useState, useEffect } from 'react';
import { MedicineMaster, InventoryItem, Supplier, Sale } from '../../types';
import { calculateSalesFeatures, calculateInventoryFeatures, calculateSupplierFeatures, calculateHospitalDemandFeature } from '../../../server/supplyChain/featureEngineering.js';
import { generateDemandForecast } from '../../../server/supplyChain/forecastingEngine.js';
import { evaluateShortageRisk } from '../../../server/supplyChain/riskEngine.js';
import { calculateReorderRecommendation } from '../../../server/supplyChain/reorderOptimizer.js';
import { simulateDoNothingTimeline } from '../../../server/supplyChain/simulator.js';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Sparkles, AlertTriangle, ShieldCheck, Clock, ArrowLeft, CloudSun, Activity, ShoppingCart, Calendar, HelpCircle } from 'lucide-react';

interface SupplyChainMedicineDetailProps {
  medicineId: string;
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  sales: Sale[];
  currentSystemDate: string;
  onBack: () => void;
}

export default function SupplyChainMedicineDetail({
  medicineId,
  medicines,
  inventory,
  suppliers,
  sales,
  currentSystemDate,
  onBack
}: SupplyChainMedicineDetailProps) {
  const medicine = medicines.find((m) => m.id === medicineId);

  if (!medicine) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
        Medicine with ID {medicineId} was not found.
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 rounded-xl text-white">Back to List</button>
      </div>
    );
  }

  // Calculate detailed features reactively
  const salesFeat = calculateSalesFeatures(sales, medicine.id, currentSystemDate);
  const invFeat = calculateInventoryFeatures(inventory, medicine.id, currentSystemDate);
  const supplierFeat = calculateSupplierFeatures(suppliers, invFeat.primarySupplierId);
  const hospitalFeat = calculateHospitalDemandFeature([], medicine.id, currentSystemDate);

  const forecastRes = generateDemandForecast(medicine, salesFeat, { hospitalDemand: hospitalFeat });
  const riskRes = evaluateShortageRisk(medicine, salesFeat, invFeat, supplierFeat, forecastRes, currentSystemDate);
  const reorderRes = calculateReorderRecommendation(medicine, invFeat, supplierFeat, forecastRes, riskRes, currentSystemDate);
  const doNothingRes = simulateDoNothingTimeline(medicine.id, invFeat.usableStock, forecastRes.baseDailyDemand, currentSystemDate, 30);

  // Build Forecast Chart Data
  const forecastChartData = [
    { name: 'Historical Avg', demand: salesFeat.dailyDemand30d * 30, lower: salesFeat.dailyDemand30d * 30, upper: salesFeat.dailyDemand30d * 30 },
    { name: '7 Days', demand: forecastRes.horizons[7].predictedDemand, lower: forecastRes.horizons[7].lowerBound, upper: forecastRes.horizons[7].upperBound },
    { name: '15 Days', demand: forecastRes.horizons[15].predictedDemand, lower: forecastRes.horizons[15].lowerBound, upper: forecastRes.horizons[15].upperBound },
    { name: '30 Days', demand: forecastRes.horizons[30].predictedDemand, lower: forecastRes.horizons[30].lowerBound, upper: forecastRes.horizons[30].upperBound },
    { name: '60 Days', demand: forecastRes.horizons[60].predictedDemand, lower: forecastRes.horizons[60].lowerBound, upper: forecastRes.horizons[60].upperBound },
    { name: '90 Days', demand: forecastRes.horizons[90].predictedDemand, lower: forecastRes.horizons[90].lowerBound, upper: forecastRes.horizons[90].upperBound }
  ];

  // Build Depletion Timeline Chart Data
  const depletionChartData = doNothingRes.timeline.map((point) => ({
    day: `Day ${point.dayOffset}`,
    date: point.date,
    stock: point.projectedStock,
    safetyStock: reorderRes.safetyStock,
    leadTimeThreshold: invFeat.usableStock > 0 ? Math.round((invFeat.usableStock / riskRes.daysOfStock) * supplierFeat.leadTimeDays) : 0
  }));

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'MODERATE':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{medicine.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-mono">
                {medicine.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Generic: {medicine.genericName} | Strength: {medicine.strength} | Manufacturer: {medicine.manufacturer}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full border text-xs font-bold font-mono ${getRiskBadge(riskRes.riskLevel)}`}>
            {riskRes.explanation.what}
          </span>
        </div>
      </div>

      {/* State Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">CURRENT TOTAL STOCK</span>
          <p className="text-2xl font-bold text-white font-mono mt-1">{invFeat.currentStock} units</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Across {invFeat.batchCount} batch(es)</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">USABLE STOCK (FEFO)</span>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{invFeat.usableStock} units</p>
          <span className="text-[10px] text-emerald-500/80 mt-1 block">Covers ~{riskRes.daysOfStock} days</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">EXPIRING WITHIN 30D</span>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{invFeat.expiringSoon30d} units</p>
          <span className="text-[10px] text-amber-500/80 mt-1 block">FEFO Discounted</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-mono text-slate-400 uppercase">DEPLETION DATE</span>
          <p className="text-xl font-bold text-amber-300 font-mono mt-1">{riskRes.expectedDepletionDate}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Supplier Lead Time: {supplierFeat.leadTimeDays}d</span>
        </div>
      </div>

      {/* Main Analysis Grid: Explainable AI & What If Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Explainable AI Reasoning Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Sparkles className="h-5 w-5 text-teal-400" />
            <h2 className="text-base font-bold text-white uppercase font-mono tracking-wider">Explainable AI Reasoning</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] font-mono text-teal-400 uppercase font-bold block mb-1">WHAT?</span>
              <p className="text-sm font-semibold text-slate-200">{riskRes.explanation.what} ({riskRes.riskScore}/100 Score)</p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] font-mono text-amber-400 uppercase font-bold block mb-1">WHEN?</span>
              <p className="text-sm font-semibold text-slate-200">{riskRes.explanation.when}</p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] font-mono text-indigo-400 uppercase font-bold block mb-2">WHY? (CONTRIBUTING FACTORS)</span>
              <ul className="space-y-2">
                {riskRes.explanation.why.map((reason, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-teal-400 mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-r from-teal-950/40 to-slate-950 border border-teal-500/30 rounded-xl p-4">
              <span className="text-[11px] font-mono text-emerald-400 uppercase font-bold block mb-1">ACTION ITEM (RECOMMENDED FOR REVIEW)</span>
              <p className="text-xs font-semibold text-teal-200">{riskRes.explanation.recommendation}</p>
              {reorderRes.recommendedQuantity > 0 && (
                <div className="mt-2 text-xs font-mono text-emerald-400">
                  Suggested Order Quantity: <strong>{reorderRes.recommendedQuantity} units</strong> (Reorder Point: {reorderRes.reorderPoint})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* "What Will Happen If We Do Nothing?" Section */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white uppercase font-mono tracking-wider">What Will Happen If We Do Nothing?</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Potential Shortage Duration</span>
                <p className="text-xl font-bold font-mono text-amber-400 mt-1">{doNothingRes.potentialShortageDurationDays} days</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Expected Unmet Demand</span>
                <p className="text-xl font-bold font-mono text-red-400 mt-1">{doNothingRes.expectedUnmetDemandUnits} units</p>
              </div>
            </div>

            {/* Depletion Slope Chart */}
            <div className="h-56 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase block mb-2">Projected 30-Day Stock Depletion</span>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={depletionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="stock" stroke="#2dd4bf" strokeWidth={2.5} dot={false} name="Projected Stock" />
                  <Line type="monotone" dataKey="safetyStock" stroke="#f59e0b" strokeDasharray="5 5" dot={false} name="Safety Stock Threshold" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Demand Forecast Chart across Horizons */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white uppercase font-mono tracking-wider">Demand Forecast Curve & Prediction Intervals</h2>
            <p className="text-xs text-slate-400 mt-0.5">Engine Model: {forecastRes.modelName} (Confidence: {forecastRes.overallConfidence}%)</p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="upper" stroke="none" fill="#0d9488" fillOpacity={0.15} name="Upper Bound" />
              <Area type="monotone" dataKey="demand" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.25} strokeWidth={2} name="Predicted Demand" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="#0f172a" fillOpacity={0.5} name="Lower Bound" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
