/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchedulerLog } from '../types';
import { 
  Play, RefreshCw, Terminal, CheckCircle2, AlertTriangle, 
  History, Calendar, Clock, Database, ChevronRight 
} from 'lucide-react';

interface SchedulerSimulatorProps {
  logs: SchedulerLog[];
  onTriggerDailyScan: () => void;
  currentSystemDate: string;
}

export default function SchedulerSimulator({
  logs,
  onTriggerDailyScan,
  currentSystemDate
}: SchedulerSimulatorProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  const runSimulation = () => {
    setIsScanning(true);
    setTerminalLogs([]);
    setActiveStep(1);

    const steps = [
      { msg: "[00:01:00] Initializing automated daily scheduler task...", delay: 300 },
      { msg: "[00:01:05] Connecting to Medicine Master Catalog... [CONNECTED]", delay: 700 },
      { msg: `[00:01:10] Auditing medicine expiry dates against current threshold (${currentSystemDate})...`, delay: 1100 },
      { msg: "[00:01:18] Found 2 EXPIRED batches. Moving metadata to quarantine registries...", delay: 1500 },
      { msg: "[00:01:25] Found 1 batch expiring within 30 days. Dispatching warning notification.", delay: 1900 },
      { msg: "[00:01:32] Scanning physical stock counts against reorder limits...", delay: 2300 },
      { msg: "[00:01:40] Alert: 4 medicines fell below active reorder thresholds. Restocking orders compiled.", delay: 2700 },
      { msg: "[00:01:48] Synchronizing database statistics and KPI dashboard values... [OK]", delay: 3100 },
      { msg: "[00:01:55] Generating automated reports for sales and inventory... [COMPILED]", delay: 3500 },
      { msg: "[00:02:00] Automated daily cron completed successfully.", delay: 3900 }
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setTerminalLogs(prev => [...prev, step.msg]);
        if (index === steps.length - 1) {
          setIsScanning(false);
          setActiveStep(0);
          onTriggerDailyScan(); // Trigger parent state update
        }
      }, step.delay);
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Autonomous System Desk
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Daily Scheduler Workflow
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Simulate and audit the automated daily cron job which sweeps exirpies, updates safety stock levels, and refreshes the KPI dashboard.
          </p>
        </div>

        <button
          onClick={runSimulation}
          disabled={isScanning}
          className="flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl cursor-pointer transition-all shrink-0"
        >
          {isScanning ? (
            <>
              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
              Auditing Stocks...
            </>
          ) : (
            <>
              <Play className="h-4.5 w-4.5 fill-white" />
              Trigger Daily Audit Job
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Terminal Simulator (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-6 flex flex-col h-[400px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-teal-400" />
              <span className="font-mono text-xs font-semibold text-teal-400">scheduler_cron_daemon_v1.0.sh</span>
            </div>
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
          </div>

          {/* Terminal stream */}
          <div className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 space-y-2 pr-1 select-none">
            {terminalLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Database className="h-10 w-10 text-slate-800 mb-2" />
                <p>Daemon status: AWAITING_TRIGGER</p>
                <p className="text-[10px] mt-1">Click the black button above to run the automated daily sweeps.</p>
              </div>
            ) : (
              terminalLogs.map((log, i) => (
                <div key={i} className="leading-relaxed animate-fade-in flex gap-2">
                  <span className="text-teal-500 select-none">&gt;</span>
                  <p>{log}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Historical Logs (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="border-b border-slate-50 pb-3.5">
            <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-teal-600" />
              Daily Audit Execution History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Logs generated automatically by scheduled sweep triggers</p>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {logs.map((log) => {
              const isSuccess = log.status === 'Success';
              return (
                <div key={log.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5 text-xs text-slate-600 hover:border-slate-200 transition-all">
                  <div className="flex justify-between items-center">
                    <span className="font-bold font-mono text-slate-700">{log.runDate}</span>
                    <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-full ${isSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {log.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-center bg-white p-2 rounded-lg border border-slate-50">
                    <div>
                      <span className="text-slate-400 block">Expiries Flagged</span>
                      <span className="font-bold text-rose-600 mt-0.5 block">{log.expiredFound}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Near Expiry Sweep</span>
                      <span className="font-bold text-amber-600 mt-0.5 block">{log.nearExpiryFound}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Shortages Flagged</span>
                      <span className="font-bold text-slate-700 mt-0.5 block">{log.lowStockFound}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-mono text-right">Run timestamp: {log.timestamp}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
