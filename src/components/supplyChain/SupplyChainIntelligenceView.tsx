/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Parent View Container for Medicine Supply Chain Intelligence Module
 */

import React, { useState } from 'react';
import { MedicineMaster, InventoryItem, Supplier, Sale } from '../../types';
import SupplyChainDashboard from './SupplyChainDashboard';
import SupplyChainMedicineDetail from './SupplyChainMedicineDetail';
import ScenarioSimulator from './ScenarioSimulator';
import DigitalTwinView from './DigitalTwinView';
import { LayoutDashboard, Sliders, Activity, ShieldAlert } from 'lucide-react';

interface SupplyChainIntelligenceViewProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  sales: Sale[];
  currentSystemDate: string;
}

export default function SupplyChainIntelligenceView({
  medicines,
  inventory,
  suppliers,
  sales,
  currentSystemDate
}: SupplyChainIntelligenceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'detail' | 'scenario' | 'digital-twin'>('dashboard');
  const [selectedMedicineId, setSelectedMedicineId] = useState<string | null>(null);

  const handleSelectMedicine = (id: string) => {
    setSelectedMedicineId(id);
    setActiveSubTab('detail');
  };

  return (
    <div className="space-y-6">
      {/* Module Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'dashboard'
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard & Shortage Risks
        </button>

        {selectedMedicineId && (
          <button
            onClick={() => setActiveSubTab('detail')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'detail'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Explainable AI Inspection
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('scenario')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'scenario'
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Scenario Simulator
        </button>

        <button
          onClick={() => setActiveSubTab('digital-twin')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'digital-twin'
              ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="h-4 w-4" />
          Digital Twin Simulation
        </button>
      </div>

      {/* Render Sub-Tab Views */}
      {activeSubTab === 'dashboard' && (
        <SupplyChainDashboard
          medicines={medicines}
          inventory={inventory}
          suppliers={suppliers}
          sales={sales}
          currentSystemDate={currentSystemDate}
          onSelectMedicine={handleSelectMedicine}
          onOpenScenarioSimulator={() => setActiveSubTab('scenario')}
          onOpenDigitalTwin={() => setActiveSubTab('digital-twin')}
        />
      )}

      {activeSubTab === 'detail' && selectedMedicineId && (
        <SupplyChainMedicineDetail
          medicineId={selectedMedicineId}
          medicines={medicines}
          inventory={inventory}
          suppliers={suppliers}
          sales={sales}
          currentSystemDate={currentSystemDate}
          onBack={() => setActiveSubTab('dashboard')}
        />
      )}

      {activeSubTab === 'scenario' && (
        <ScenarioSimulator
          medicines={medicines}
          inventory={inventory}
          suppliers={suppliers}
          sales={sales}
          currentSystemDate={currentSystemDate}
          initialMedicineId={selectedMedicineId || undefined}
        />
      )}

      {activeSubTab === 'digital-twin' && (
        <DigitalTwinView
          medicines={medicines}
          inventory={inventory}
          suppliers={suppliers}
          currentSystemDate={currentSystemDate}
        />
      )}
    </div>
  );
}
