/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supply Chain Digital Twin Simulation Component
 */

import React, { useState } from 'react';
import { MedicineMaster, InventoryItem, Supplier } from '../../types';
import { Network, Truck, Warehouse, Store, UserCheck, AlertCircle, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { getDigitalTwinState } from '../../../server/supplyChain/simulator.js';

interface DigitalTwinViewProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  currentSystemDate: string;
}

export default function DigitalTwinView({
  medicines,
  inventory,
  suppliers,
  currentSystemDate
}: DigitalTwinViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('warehouse');
  const [simulatedDelay, setSimulatedDelay] = useState<boolean>(false);
  const [simulatedDemandSpike, setSimulatedDemandSpike] = useState<boolean>(false);

  const twinState = getDigitalTwinState(medicines, inventory, suppliers, currentSystemDate);

  const getNodeIcon = (id: string) => {
    switch (id) {
      case 'supplier':
        return <Network className="h-6 w-6 text-indigo-400" />;
      case 'shipment':
        return <Truck className="h-6 w-6 text-amber-400" />;
      case 'warehouse':
        return <Warehouse className="h-6 w-6 text-teal-400" />;
      case 'pharmacy':
        return <Store className="h-6 w-6 text-blue-400" />;
      case 'patient':
        return <UserCheck className="h-6 w-6 text-emerald-400" />;
      default:
        return <Zap className="h-6 w-6 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Network className="h-6 w-6 text-teal-400" />
              <h2 className="text-xl font-bold text-white">Supply Chain Digital Twin Simulation</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Live simulation model of pharmaceutical inventory flows from primary suppliers down to patient consumption.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSimulatedDelay(!simulatedDelay)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                simulatedDelay ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Truck className="h-4 w-4" />
              {simulatedDelay ? 'Simulating Transit Delay' : 'Simulate Transit Delay'}
            </button>

            <button
              onClick={() => setSimulatedDemandSpike(!simulatedDemandSpike)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                simulatedDemandSpike ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Zap className="h-4 w-4" />
              {simulatedDemandSpike ? 'Simulating Demand Spike' : 'Simulate Demand Spike'}
            </button>
          </div>
        </div>

        {/* Digital Twin Node Flow Visualization */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-x-auto mb-6">
          <div className="flex items-center justify-between min-w-[760px] gap-4 relative">
            {twinState.nodes.map((node, index) => {
              const isSelected = selectedNodeId === node.id;
              const hasAlert = (node.id === 'shipment' && simulatedDelay) || (node.id === 'patient' && simulatedDemandSpike);

              return (
                <React.Fragment key={node.id}>
                  {/* Node Card */}
                  <div
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`flex-1 cursor-pointer p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-teal-500/60 shadow-lg shadow-teal-500/10 scale-105'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-slate-950 rounded-lg">{getNodeIcon(node.id)}</div>
                      {hasAlert ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">{node.label}</h3>
                    <p className="text-xs font-mono text-teal-400 font-semibold mt-1">{node.metric}</p>
                    <span className="text-[10px] text-slate-400 block mt-2">{node.status}</span>
                  </div>

                  {/* Flow Arrow */}
                  {index < twinState.nodes.length - 1 && (
                    <div className="flex flex-col items-center shrink-0">
                      <ArrowRight className={`h-5 w-5 ${simulatedDelay && index === 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                      <span className="text-[9px] font-mono text-slate-500 mt-1">
                        {simulatedDelay && index === 0 ? '+3d Delay' : twinState.flows[index]?.latency}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Selected Node Details */}
        {selectedNodeId && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-200 uppercase font-mono tracking-wider mb-2">
              NODE INSPECTION: {selectedNodeId.toUpperCase()}
            </h3>
            <p className="text-xs text-slate-400">
              {selectedNodeId === 'supplier' && 'Tracking lead times and fill rates across active suppliers. Average lead time is currently stable.'}
              {selectedNodeId === 'shipment' && (simulatedDelay ? 'WARNING: Transit bottleneck detected. Shipments delayed by +3 days due to regional logistics.' : 'Shipment pipeline normal with 3 active purchase orders in transit.')}
              {selectedNodeId === 'warehouse' && `Central inventory holding ${inventory.length} distinct batches across formulary items.`}
              {selectedNodeId === 'pharmacy' && `Rx desk operating normally with real-time FEFO inventory dispatch.`}
              {selectedNodeId === 'patient' && (simulatedDemandSpike ? 'CRITICAL SIGNAL: Regional demand spike of +35% detected in respiratory medicines.' : 'Patient consumption rate is stable.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
