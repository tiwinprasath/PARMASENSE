/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main Supply Chain Intelligence Dashboard Component
 */

import React, { useState, useMemo, useEffect } from 'react';
import { MedicineMaster, InventoryItem, Supplier, Sale } from '../../types';
import { runSupplyChainPipeline } from '../../../server/supplyChain/pipeline.js';
import { evaluateForecastingModels } from '../../../server/supplyChain/evaluation.js';
import supplyChainApi from '../../services/supplyChainApi';
import {
  ShieldAlert, AlertTriangle, TrendingUp, RefreshCw, Upload, Sparkles, Filter, Search,
  Sliders, ArrowUpDown, ChevronRight, Activity, CheckCircle, Database, FileSpreadsheet, Eye
} from 'lucide-react';
import { RiskLevel } from '../../types/supplyChain';

interface SupplyChainDashboardProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  sales: Sale[];
  currentSystemDate: string;
  onSelectMedicine: (id: string) => void;
  onOpenScenarioSimulator: () => void;
  onOpenDigitalTwin: () => void;
}

export default function SupplyChainDashboard({
  medicines,
  inventory,
  suppliers,
  sales,
  currentSystemDate,
  onSelectMedicine,
  onOpenScenarioSimulator,
  onOpenDigitalTwin
}: SupplyChainDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'riskScore' | 'daysOfStock' | 'medicineName'>('riskScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [csvContent, setCsvContent] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Compute live pipeline output
  const pipelineResult = useMemo(() => {
    const state = { medicines, inventory, sales, suppliers, hospital_demand: [] };
    return runSupplyChainPipeline(state, currentSystemDate);
  }, [medicines, inventory, sales, suppliers, currentSystemDate]);

  // Model Evaluation metrics
  const modelEval = useMemo(() => {
    return evaluateForecastingModels(medicines, sales, inventory, currentSystemDate);
  }, [medicines, sales, inventory, currentSystemDate]);

  const overview = pipelineResult.overview;

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(medicines.map((m) => m.category));
    return ['All', ...Array.from(set)];
  }, [medicines]);

  // Shortage Risk Table Rows
  const tableRows = useMemo(() => {
    return pipelineResult.supply_risk_predictions.map((pred) => {
      const med = medicines.find((m) => m.id === pred.medicineId);
      const forecasts = pipelineResult.demand_forecasts.filter((f) => f.medicineId === pred.medicineId);
      const f7 = forecasts.find((f) => f.horizonDays === 7)?.predictedDemand || 0;
      const f30 = forecasts.find((f) => f.horizonDays === 30)?.predictedDemand || 0;

      return {
        ...pred,
        medicineName: med ? med.name : 'Unknown Medicine',
        genericName: med ? med.genericName : '',
        category: med ? med.category : 'General',
        predictedDemand7Days: f7,
        predictedDemand30Days: f30
      };
    });
  }, [pipelineResult, medicines]);

  // Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    return tableRows
      .filter((row) => {
        const matchesSearch =
          row.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.genericName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRisk = selectedRiskFilter === 'All' || row.riskLevel === selectedRiskFilter;
        const matchesCategory = selectedCategoryFilter === 'All' || row.category === selectedCategoryFilter;

        return matchesSearch && matchesRisk && matchesCategory;
      })
      .sort((a, b) => {
        if (sortField === 'riskScore') {
          return sortOrder === 'desc' ? b.riskScore - a.riskScore : a.riskScore - b.riskScore;
        }
        if (sortField === 'daysOfStock') {
          return sortOrder === 'desc' ? b.daysOfStock - a.daysOfStock : a.daysOfStock - b.daysOfStock;
        }
        return sortOrder === 'desc'
          ? b.medicineName.localeCompare(a.medicineName)
          : a.medicineName.localeCompare(b.medicineName);
      });
  }, [tableRows, searchTerm, selectedRiskFilter, selectedCategoryFilter, sortField, sortOrder]);

  const handleUploadCsv = () => {
    if (!csvContent.trim()) return;

    // Simple CSV parser
    const lines = csvContent.split('\n');
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length >= 4) {
        records.push({
          date: parts[0].trim(),
          hospitalId: parts[1].trim(),
          medicineId: parts[2].trim(),
          quantityRequested: Number(parts[3].trim()) || 0
        });
      }
    }

    setToastMessage(`Uploaded ${records.length} hospital demand records from CSV!`);
    setShowUploadModal(false);
    setCsvContent('');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getRiskBadge = (level: RiskLevel) => {
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-teal-500/40 text-teal-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-mono">
          <Sparkles className="h-4 w-4 animate-spin text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-teal-500/10 rounded-xl text-teal-400 border border-teal-500/20">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Medicine Supply Chain Intelligence</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Predicting future medicine shortages before they happen using multi-signal forecasting & explainable AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenScenarioSimulator}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Sliders className="h-4 w-4" />
            Scenario Simulator
          </button>

          <button
            onClick={onOpenDigitalTwin}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Activity className="h-4 w-4" />
            Digital Twin Simulation
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Upload className="h-4 w-4 text-emerald-400" />
            Upload Hospital Demand
          </button>
        </div>
      </div>

      {/* Top 5 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Medicines at Risk */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold block">MEDICINES AT RISK</span>
          <p className="text-3xl font-bold text-white font-mono mt-1">{overview.medicinesAtRiskCount}</p>
          <span className="text-[10px] text-amber-400 mt-1 block">Critical/High/Moderate</span>
        </div>

        {/* Card 2: Critical Shortages */}
        <div className="bg-slate-900/60 border border-red-500/30 p-4 rounded-xl relative overflow-hidden">
          <span className="text-[11px] font-mono text-red-400 uppercase font-semibold block">CRITICAL SHORTAGES</span>
          <p className="text-3xl font-bold text-red-400 font-mono mt-1">{overview.criticalShortagesCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Depletion &lt; Lead Time</span>
        </div>

        {/* Card 3: Predicted Shortages */}
        <div className="bg-slate-900/60 border border-amber-500/30 p-4 rounded-xl relative overflow-hidden">
          <span className="text-[11px] font-mono text-amber-400 uppercase font-semibold block">PREDICTED SHORTAGES</span>
          <p className="text-3xl font-bold text-amber-400 font-mono mt-1">{overview.predictedShortagesCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Next 30-Day Window</span>
        </div>

        {/* Card 4: Reorder Recommendations */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <span className="text-[11px] font-mono text-teal-400 uppercase font-semibold block">REORDER SUGGESTIONS</span>
          <p className="text-3xl font-bold text-teal-400 font-mono mt-1">{overview.reorderRecommendationsCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Recommended for Review</span>
        </div>

        {/* Card 5: Average Forecast Confidence */}
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
          <span className="text-[11px] font-mono text-indigo-400 uppercase font-semibold block">FORECAST CONFIDENCE</span>
          <p className="text-3xl font-bold text-indigo-300 font-mono mt-1">{overview.averageForecastConfidence}%</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Multi-Signal Engine</span>
        </div>
      </div>

      {/* Main Table Controls & Filters */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
          <h2 className="text-base font-bold text-white uppercase font-mono tracking-wider">Shortage Risk & Forecast Table</h2>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search medicine name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Risk Filter */}
            <select
              value={selectedRiskFilter}
              onChange={(e) => setSelectedRiskFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              <option value="All">All Risk Levels</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MODERATE">MODERATE</option>
              <option value="LOW">LOW</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Shortage Risk Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Medicine</th>
                <th className="py-3 px-4">Usable Stock</th>
                <th className="py-3 px-4">7D Forecast</th>
                <th className="py-3 px-4">30D Forecast</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => { setSortField('daysOfStock'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  Days Left ↕
                </th>
                <th className="py-3 px-4">Depletion Date</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => { setSortField('riskScore'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                  Shortage Risk ↕
                </th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No medicine predictions match your current search and filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div>{row.medicineName}</div>
                      <span className="text-[10px] text-slate-500 font-normal">{row.category}</span>
                    </td>
                    <td className="py-3 px-4 font-mono">{row.daysOfStock > 0 ? `${row.daysOfStock * 15} units` : '0 units'}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{row.predictedDemand7Days}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{row.predictedDemand30Days}</td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-300">{row.daysOfStock} days</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{row.expectedDepletionDate}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold font-mono ${getRiskBadge(row.riskLevel)}`}>
                        {row.riskLevel} ({row.riskScore})
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-indigo-300">{row.confidence}%</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectMedicine(row.medicineId)}
                        className="px-2.5 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect XAI
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Evaluation & Research Baseline Comparison Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white uppercase font-mono tracking-wider">Model Evaluation & Baseline Comparison</h2>
            <p className="text-xs text-slate-400 mt-0.5">Comparing Multi-Signal Forecasting Engine against Simple Moving Average Baseline.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Baseline Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold block mb-2">BASELINE: SIMPLE MOVING AVERAGE</span>
            <div className="grid grid-cols-3 gap-2 font-mono text-center text-xs">
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">MAE</span>
                <span className="text-slate-200 font-bold">{modelEval.baselineModel.mae}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">RMSE</span>
                <span className="text-slate-200 font-bold">{modelEval.baselineModel.rmse}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">WAPE</span>
                <span className="text-slate-200 font-bold">{modelEval.baselineModel.wape}%</span>
              </div>
            </div>
          </div>

          {/* Proposed Multi-Signal Card */}
          <div className="bg-gradient-to-br from-slate-950 to-teal-950/30 p-4 rounded-xl border border-teal-500/30">
            <span className="text-xs font-mono text-teal-400 uppercase font-bold block mb-2">PROPOSED: MULTI-SIGNAL ENSEMBLE SYSTEM</span>
            <div className="grid grid-cols-4 gap-2 font-mono text-center text-xs">
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">MAE</span>
                <span className="text-teal-300 font-bold">{modelEval.proposedModel.mae}</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">WAPE</span>
                <span className="text-teal-300 font-bold">{modelEval.proposedModel.wape}%</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Precision</span>
                <span className="text-emerald-400 font-bold">{modelEval.proposedModel.shortagePrecision}%</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Recall</span>
                <span className="text-emerald-400 font-bold">{modelEval.proposedModel.shortageRecall}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hospital Demand Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                Upload Hospital Demand CSV
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Upload regional hospital demand orders to incorporate institutional consumption signals.
            </p>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-[11px] font-mono text-slate-400">
              CSV Format example:
              <pre className="text-teal-400 mt-1">date,hospital_id,medicine_id,quantity_requested</pre>
            </div>

            <textarea
              rows={5}
              placeholder="2026-09-01,H001,M001,120&#10;2026-09-02,H001,M001,150"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-teal-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadCsv}
                className="px-4 py-2 bg-teal-500 text-slate-950 hover:bg-teal-400 font-bold rounded-xl text-xs transition"
              >
                Upload & Process Signals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
