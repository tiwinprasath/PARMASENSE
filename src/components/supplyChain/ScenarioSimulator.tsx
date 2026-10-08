/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive Scenario Simulator Component
 */

import React, { useState, useEffect } from 'react';
import { MedicineMaster, InventoryItem, Supplier, Sale } from '../../types';
import { calculateSalesFeatures, calculateInventoryFeatures, calculateSupplierFeatures } from '../../../server/supplyChain/featureEngineering.js';
import { generateDemandForecast } from '../../../server/supplyChain/forecastingEngine.js';
import { runScenarioSimulation } from '../../../server/supplyChain/simulator.js';
import { Sliders, RefreshCw, AlertTriangle, ShieldCheck, TrendingUp, Clock, PackagePlus } from 'lucide-react';

interface ScenarioSimulatorProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  sales: Sale[];
  currentSystemDate: string;
  initialMedicineId?: string;
}

export default function ScenarioSimulator({
  medicines,
  inventory,
  suppliers,
  sales,
  currentSystemDate,
  initialMedicineId
}: ScenarioSimulatorProps) {
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>(
    initialMedicineId || (medicines[0]?.id || '')
  );

  const [demandMultiplier, setDemandMultiplier] = useState<number>(1.25); // +25%
  const [supplierDelayDays, setSupplierDelayDays] = useState<number>(3); // +3 days
  const [incomingAdjustment, setIncomingAdjustment] = useState<number>(0);

  const selectedMed = medicines.find((m) => m.id === selectedMedicineId);

  // Run simulation reactively
  const simulationResult = React.useMemo(() => {
    if (!selectedMed) return null;

    const salesFeat = calculateSalesFeatures(sales, selectedMed.id, currentSystemDate);
    const invFeat = calculateInventoryFeatures(inventory, selectedMed.id, currentSystemDate);
    const supplierFeat = calculateSupplierFeatures(suppliers, invFeat.primarySupplierId);
    const forecastRes = generateDemandForecast(selectedMed, salesFeat);

    return runScenarioSimulation(
      selectedMed,
      salesFeat,
      invFeat,
      supplierFeat,
      forecastRes,
      currentSystemDate,
      {
        demandMultiplier,
        supplierDelayDays,
        incomingStockAdjustment: incomingAdjustment
      }
    );
  }, [selectedMed, sales, inventory, suppliers, currentSystemDate, demandMultiplier, supplierDelayDays, incomingAdjustment]);

  if (!selectedMed || !simulationResult) {
    return <div className="p-6 text-slate-400">Please select a valid medicine to run scenario simulation.</div>;
  }

  const { baseline, simulated } = simulationResult;

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'MODERATE':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-6 w-6 text-teal-400" />
              <h2 className="text-xl font-bold text-white">Supply Chain Scenario Simulator</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulate decision support scenarios: test demand spikes, supplier delays, or emergency restocks to observe real-time risk shifts.
            </p>
          </div>

          {/* Medicine Selector */}
          <div className="w-full md:w-72">
            <label className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">Target Medicine</label>
            <select
              value={selectedMedicineId}
              onChange={(e) => setSelectedMedicineId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.genericName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Simulation Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 mb-8">
          {/* Slider 1: Demand Multiplier */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-teal-400" />
                Demand Multiplier
              </span>
              <span className="text-xs font-mono text-teal-400 font-bold">
                {demandMultiplier >= 1 ? `+${Math.round((demandMultiplier - 1) * 100)}%` : `-${Math.round((1 - demandMultiplier) * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              value={demandMultiplier}
              onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
              className="w-full accent-teal-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>-50% (Slump)</span>
              <span>Baseline (1.0x)</span>
              <span>+150% (Outbreak)</span>
            </div>
          </div>

          {/* Slider 2: Supplier Delay */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-400" />
                Supplier Delivery Delay
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">
                +{supplierDelayDays} Days
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="14"
              step="1"
              value={supplierDelayDays}
              onChange={(e) => setSupplierDelayDays(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>On-Time (0d)</span>
              <span>+7d Delay</span>
              <span>+14d Severe</span>
            </div>
          </div>

          {/* Slider 3: Incoming Stock Adjustment */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <PackagePlus className="h-4 w-4 text-emerald-400" />
                Incoming Stock Adjustment
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {incomingAdjustment > 0 ? `+${incomingAdjustment}` : incomingAdjustment} Units
              </span>
            </div>
            <input
              type="range"
              min="-200"
              max="500"
              step="25"
              value={incomingAdjustment}
              onChange={(e) => setIncomingAdjustment(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>-200 (Damage)</span>
              <span>0 (Normal)</span>
              <span>+500 (Batch Order)</span>
            </div>
          </div>
        </div>

        {/* Before vs After Scenario Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Baseline State Card */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-3">CURRENT BASELINE STATE</span>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs text-slate-400">Risk Level</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${getRiskBadge(baseline.riskLevel)}`}>
                  {baseline.riskLevel}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs text-slate-400">Days of Stock</span>
                <span className="text-sm font-mono text-slate-200">{baseline.daysOfStock} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Reorder Point (ROP)</span>
                <span className="text-sm font-mono text-slate-200">{baseline.reorderPoint} units</span>
              </div>
            </div>
          </div>

          {/* Simulated State Card */}
          <div className="bg-gradient-to-br from-slate-950 to-teal-950/30 border border-teal-500/30 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-teal-500/10 text-teal-400 text-[10px] font-mono font-bold px-3 py-1 rounded-bl-xl border-l border-b border-teal-500/30">
              SIMULATED SCENARIO
            </div>
            <span className="text-[11px] font-mono text-teal-400 uppercase tracking-wider block mb-3">PROJECTED OUTCOME</span>
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs text-slate-300">Projected Risk Level</span>
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${getRiskBadge(simulated.riskLevel)}`}>
                  {simulated.riskLevel} ({simulated.riskScore}/100)
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs text-slate-300">Projected Stock Coverage</span>
                <span className="text-sm font-mono font-bold text-teal-300">{simulated.daysOfStock} days</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                <span className="text-xs text-slate-300">Projected Depletion Date</span>
                <span className="text-sm font-mono text-amber-300">{simulated.expectedDepletionDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-300">Required Reorder Qty</span>
                <span className="text-base font-mono font-bold text-teal-400">{simulated.recommendedQuantity} units</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
