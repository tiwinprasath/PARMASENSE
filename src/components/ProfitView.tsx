/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MedicineMaster, InventoryItem, Sale, Notification } from '../types';
import { 
  DollarSign, TrendingUp, AlertTriangle, ShieldCheck, 
  Calendar, CheckCircle2, ChevronRight, BarChart3, 
  ArrowUpRight, Sparkles, AlertOctagon, HelpCircle
} from 'lucide-react';

interface ProfitViewProps {
  inventory: InventoryItem[];
  medicines: MedicineMaster[];
  sales: Sale[];
  onUpdateInventory: (updated: InventoryItem[]) => void;
  onAddNotification: (noti: Notification) => void;
  currentSystemDate: string;
}

export default function ProfitView({
  inventory,
  medicines,
  sales,
  onUpdateInventory,
  onAddNotification,
  currentSystemDate
}: ProfitViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(currentSystemDate);

  React.useEffect(() => {
    setSelectedDate(currentSystemDate);
  }, [currentSystemDate]);
  const [sweepExecuted, setSweepExecuted] = useState<boolean>(false);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepResult, setSweepResult] = useState<{ quarantinedCount: number; lostValue: number } | null>(null);

  // 1. Calculate Profit data grouped by day
  const dailyProfitLedger = useMemo(() => {
    const dailyData: { 
      [date: string]: { 
        date: string;
        billsCount: number;
        revenue: number;
        cogs: number; // Cost of goods sold
        profit: number;
        salesDetails: Array<{
          id: string;
          medicineName: string;
          quantity: number;
          price: number;
          discount: number;
          totalAmount: number;
          costPrice: number;
          profit: number;
        }>;
      } 
    } = {};

    // Process all sales
    sales.forEach(s => {
      const date = s.date;
      const invItem = inventory.find(i => i.medicineId === s.medicineId);
      const costPrice = invItem ? invItem.purchasePrice : s.price * 0.5; // fallback to 50% purchase price
      const itemCogs = costPrice * s.quantity;
      const itemProfit = s.totalAmount - itemCogs;
      const medName = medicines.find(m => m.id === s.medicineId)?.name || 'Unknown Medicine';

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          billsCount: 0,
          revenue: 0,
          cogs: 0,
          profit: 0,
          salesDetails: []
        };
      }

      dailyData[date].billsCount += 1;
      dailyData[date].revenue += s.totalAmount;
      dailyData[date].cogs += itemCogs;
      dailyData[date].profit += itemProfit;
      dailyData[date].salesDetails.push({
        id: s.id,
        medicineName: medName,
        quantity: s.quantity,
        price: s.price,
        discount: s.discount,
        totalAmount: s.totalAmount,
        costPrice,
        profit: itemProfit
      });
    });

    // Convert to sorted array (most recent first)
    return Object.values(dailyData).sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, inventory, medicines]);

  // Find selected date data for details panel
  const selectedDayData = useMemo(() => {
    return dailyProfitLedger.find(d => d.date === selectedDate) || null;
  }, [dailyProfitLedger, selectedDate]);

  // Overall statistics
  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalCogs = 0;
    let totalProfit = 0;
    let totalBills = 0;

    dailyProfitLedger.forEach(d => {
      totalRevenue += d.revenue;
      totalCogs += d.cogs;
      totalProfit += d.profit;
      totalBills += d.billsCount;
    });

    // Expired value loss calculations
    const expiredLoss = inventory
      .filter(item => item.status === 'Expired' || new Date(item.expiryDate) <= new Date(currentSystemDate))
      .reduce((sum, item) => sum + (item.currentQuantity * item.purchasePrice), 0);

    const activeMeds = medicines.length;

    return {
      totalRevenue,
      totalCogs,
      totalProfit,
      totalBills,
      expiredLoss,
      activeMeds,
      margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    };
  }, [dailyProfitLedger, inventory, medicines]);

  // Today's stats
  const todayStats = useMemo(() => {
    const todayData = dailyProfitLedger.find(d => d.date === currentSystemDate);
    return todayData || { date: currentSystemDate, billsCount: 0, revenue: 0, cogs: 0, profit: 0, salesDetails: [] };
  }, [dailyProfitLedger, currentSystemDate]);

  // 2. Automated Daily Expiry Checking and Quarantine Logic
  const expiredItems = useMemo(() => {
    const currentDate = new Date(currentSystemDate);
    return inventory.filter(item => {
      const expDate = new Date(item.expiryDate);
      return expDate <= currentDate;
    });
  }, [inventory, currentSystemDate]);

  // Active expired items that are NOT currently marked as 'Expired' in their status
  const newlyExpiredNeedAction = useMemo(() => {
    return expiredItems.filter(item => item.status !== 'Expired');
  }, [expiredItems]);

  const runDailyExpiryCheck = () => {
    setIsSweeping(true);
    
    // Simulate some loading delay for beautiful UI feel
    setTimeout(() => {
      const currentDate = new Date(currentSystemDate);
      let count = 0;
      let totalValue = 0;

      const updatedInventory = inventory.map(item => {
        const expDate = new Date(item.expiryDate);
        if (expDate <= currentDate && item.status !== 'Expired') {
          count++;
          totalValue += (item.purchasePrice * item.currentQuantity);
          return {
            ...item,
            status: 'Expired' as const
          };
        }
        return item;
      });

      if (count > 0) {
        onUpdateInventory(updatedInventory);
        
        const timestamp = new Date(currentSystemDate).toLocaleDateString();
        onAddNotification({
          id: `NOT-PROFIT-SWEEP-${Date.now()}`,
          type: 'expired',
          title: `Daily Sweep: ${count} Batches Quarantined`,
          message: `Automated daily expiry run detected ${count} batches that reached their expiration date. Total asset write-off value: ₹${totalValue.toFixed(2)}. Status changed to Expired and locked.`,
          date: currentSystemDate,
          isRead: false,
          severity: 'error'
        });
      }

      setSweepResult({
        quarantinedCount: count,
        lostValue: totalValue
      });
      setIsSweeping(false);
      setSweepExecuted(true);
    }, 1200);
  };

  // SVG Chart Height helpers
  const chartHeight = 180;
  const chartWidth = 500;
  const maxLedgerProfit = Math.max(...dailyProfitLedger.map(d => d.profit), 500);

  return (
    <div className="space-y-6" id="profit_view_panel">
      {/* Dynamic Notifications Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            Financial & Compliance Center
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Profit Desk & Daily Sweeps
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Perform daily sales profit audits, track cost of goods sold, and run automated sweeps to quarantine expired stock.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Calendar className="h-4.5 w-4.5 text-slate-400" />
          <span className="font-mono text-sm font-semibold text-slate-600">
            System Date: 2026-07-07
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <span className="flex items-center text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
              Today's Gain
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Today's Sales Profit</p>
            <h3 className="text-2xl font-mono font-bold text-slate-800 mt-1">
              ₹{todayStats.profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Revenue: <b>₹{todayStats.revenue.toFixed(0)}</b></span>
              <span>COGS: <b>₹{todayStats.cogs.toFixed(0)}</b></span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Cumulative Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-100">
              <DollarSign className="h-6 w-6 text-teal-600" />
            </div>
            <span className="flex items-center text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-mono">
              Total Cumulative
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Net Profit</p>
            <h3 className="text-2xl font-mono font-bold text-slate-800 mt-1">
              ₹{totals.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Avg Margin: <b className="text-emerald-600">{totals.margin.toFixed(1)}%</b></span>
              <span>Total Bills: <b>{totals.totalBills}</b></span>
            </div>
          </div>
        </div>

        {/* KPI 3: Expired Products Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
              <AlertOctagon className="h-6 w-6 text-rose-600" />
            </div>
            <span className="flex items-center text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-mono">
              Quarantined
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Expired Product Batches</p>
            <h3 className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {expiredItems.length} <span className="text-xs font-sans font-normal text-slate-500">Batches</span>
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Needs sweep action: <b className={`${newlyExpiredNeedAction.length > 0 ? 'text-rose-600 animate-pulse font-bold' : 'text-slate-600'}`}>{newlyExpiredNeedAction.length}</b></span>
            </div>
          </div>
        </div>

        {/* KPI 4: Capital Loss from Expiries */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <span className="flex items-center text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-mono">
              Write-Off Liability
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Expired Capital Loss</p>
            <h3 className="text-2xl font-mono font-bold text-rose-600 mt-1">
              ₹{totals.expiredLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Loss from purchase cost</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Core Content: Daily Profit Chart & Sweeper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Grid Area: Expiry Sweeper Action (Col Span 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Section: Daily Expiry Checker */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5 text-rose-500" />
                  Daily Expiry Sweep Control
                </h3>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                  24h Sweep Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                System policy mandates daily audits. Running the sweep automatically scans batch records, flags expired items, locks them from POS selection, and compiles inventory write-off losses.
              </p>

              {newlyExpiredNeedAction.length > 0 ? (
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/60 mb-5 space-y-3.5 animate-pulse">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-800">
                      Unresolved Expirations Detected!
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 font-medium">
                    There are <b>{newlyExpiredNeedAction.length}</b> batch(es) that have reached their expiration dates but have not been formally quarantined and locked in status.
                  </p>
                  <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                    {newlyExpiredNeedAction.map((item, idx) => {
                      const medName = medicines.find(m => m.id === item.medicineId)?.name || 'Unknown';
                      return (
                        <div key={idx} className="bg-white/70 p-2 rounded border border-amber-100 flex justify-between items-center text-[10px] font-mono text-slate-600">
                          <span className="truncate max-w-[150px] font-bold">{medName}</span>
                          <span>B: {item.batchNumber} (Exp: {item.expiryDate})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/60 mb-5 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-emerald-800 block">Formulary Quarantined</span>
                    <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                      All currently expired medicine batches in physical inventory have been audited, updated to Expired status, and isolated from sales.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-50">
              <button
                onClick={runDailyExpiryCheck}
                disabled={isSweeping || newlyExpiredNeedAction.length === 0}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer shadow-sm"
              >
                {isSweeping ? (
                  <>
                    <span className="h-4 w-4 border-2 border-slate-400 border-t-white rounded-full animate-spin inline-block mr-1" />
                    Running Daily Sweep...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4.5 w-4.5" />
                    {newlyExpiredNeedAction.length > 0 
                      ? `Quarantine Expired Products (-${newlyExpiredNeedAction.length} Batches)`
                      : 'Audit & Clear Completed'}
                  </>
                )}
              </button>

              {sweepExecuted && sweepResult && (
                <div className="mt-3.5 p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs animate-fade-in">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    Sweep Completed Successfully
                  </div>
                  <ul className="list-disc list-inside mt-2 text-emerald-700 font-mono space-y-1 text-[11px]">
                    <li>Formal quarantines declared: <b>{sweepResult.quarantinedCount}</b> batches</li>
                    <li>Locked assets inventory value: <b>₹{sweepResult.lostValue.toFixed(2)}</b></li>
                    <li>Audit flags broadcast to Dashboard desk</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Grid Area: Daily Net Profit Audit Charts & Lists (Col Span 7) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50 pb-4 mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Daily Net Profit Auditing
                </h3>
                <p className="text-xs text-slate-400">Daily net profit trend and margins computed in real-time</p>
              </div>
            </div>

            {dailyProfitLedger.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 h-[220px]">
                <DollarSign className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No Sales History Found</p>
                <p className="text-xs">Record POS checkout transactions to view real-time daily profit analytics.</p>
              </div>
            ) : (
              <div className="w-full flex justify-center py-2">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-[500px] overflow-visible">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                    const y = chartHeight - 30 - p * (chartHeight - 50);
                    const value = Math.round(maxLedgerProfit * p);
                    return (
                      <g key={i} className="opacity-40">
                        <line x1="45" y1={y} x2={chartWidth - 10} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                        <text x="35" y={y + 4} textAnchor="end" className="fill-slate-400 font-mono text-[9px]">
                          ₹{value}
                        </text>
                      </g>
                    );
                  })}

                  {/* Bars & Labels */}
                  {dailyProfitLedger.slice().reverse().map((day, index) => {
                    const barCount = dailyProfitLedger.length;
                    const sectionWidth = (chartWidth - 65) / barCount;
                    const xBase = 55 + index * sectionWidth;
                    const barWidth = Math.max(14, sectionWidth * 0.5);

                    const profHeight = (day.profit / maxLedgerProfit) * (chartHeight - 50);
                    const profY = chartHeight - 30 - profHeight;

                    return (
                      <g key={index} className="group cursor-pointer">
                        {/* Hover Background overlay */}
                        <rect 
                          x={xBase - sectionWidth * 0.1} 
                          y="10" 
                          width={sectionWidth} 
                          height={chartHeight - 35} 
                          className="fill-transparent hover:fill-slate-50/50 transition-all rounded"
                        />

                        {/* Profit Bar (Emerald) */}
                        <rect
                          x={xBase - barWidth / 2}
                          y={profY}
                          width={barWidth}
                          height={Math.max(3, profHeight)}
                          className="fill-emerald-500 hover:fill-emerald-600 transition-all"
                          rx="4"
                        />

                        {/* Value on top of bar on hover */}
                        <text
                          x={xBase}
                          y={profY - 6}
                          textAnchor="middle"
                          className="fill-emerald-700 font-mono text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-all"
                        >
                          ₹{day.profit.toFixed(0)}
                        </text>

                        {/* Title Tooltip */}
                        <title>{`Date: ${day.date}\nProfit: ₹${day.profit.toFixed(2)}\nRevenue: ₹${day.revenue.toFixed(2)}\nBills: ${day.billsCount}`}</title>

                        {/* X-Axis labels */}
                        <text
                          x={xBase}
                          y={chartHeight - 12}
                          textAnchor="middle"
                          className="fill-slate-500 font-semibold font-mono text-[9px]"
                        >
                          {day.date.substring(5)}
                        </text>
                      </g>
                    );
                  })}

                  <line x1="45" y1={chartHeight - 30} x2={chartWidth - 10} y2={chartHeight - 30} stroke="#cbd5e1" strokeWidth="1.5" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4 mt-2 border-t border-slate-50 pt-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-emerald-500 inline-block" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono">Net Profit Contribution (₹)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Profit Ledger list (Full width table) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-50 pb-4 mb-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" />
              Comprehensive Daily Sales Profit Ledger
            </h3>
            <p className="text-xs text-slate-400">Expand any date below to inspect the detailed checkout records and margins</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total active days: <b>{dailyProfitLedger.length}</b>
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead className="bg-slate-50/80 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-center">Checkout Bills</th>
                <th className="py-3.5 px-4 text-right">Gross Revenue</th>
                <th className="py-3.5 px-4 text-right">Cost of Goods Sold (COGS)</th>
                <th className="py-3.5 px-4 text-right">Daily Sales Profit</th>
                <th className="py-3.5 px-4 text-right">Net Margin</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {dailyProfitLedger.map((day, idx) => {
                const margin = day.revenue > 0 ? (day.profit / day.revenue) * 100 : 0;
                const isSelected = selectedDate === day.date;
                return (
                  <React.Fragment key={idx}>
                    <tr className={`hover:bg-slate-50/50 transition-all ${isSelected ? 'bg-slate-50/80 font-semibold' : ''}`}>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{day.date}</td>
                      <td className="py-3.5 px-4 text-center text-slate-600 font-semibold">{day.billsCount}</td>
                      <td className="py-3.5 px-4 text-right text-slate-600">₹{day.revenue.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right text-slate-400">₹{day.cogs.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right text-emerald-600 font-bold">₹{day.profit.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${margin >= 40 ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedDate(isSelected ? '' : day.date)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded font-semibold text-[10px] cursor-pointer transition-all inline-flex items-center gap-1"
                        >
                          {isSelected ? 'Collapse' : 'Inspect Detailed Bills'}
                          <ChevronRight className={`h-3 w-3 transform transition-all ${isSelected ? 'rotate-90' : ''}`} />
                        </button>
                      </td>
                    </tr>
                    
                    {/* Collapsible Details Panel */}
                    {isSelected && (
                      <tr>
                        <td colSpan={7} className="bg-slate-50/50 p-4 border-t border-b border-slate-100">
                          <div className="space-y-3.5 animate-fade-in">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 px-1 font-sans">
                              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                              Fulfillment Margin Audit for {day.date}
                            </h4>
                            <div className="overflow-hidden rounded-lg border border-slate-200/60 bg-white">
                              <table className="w-full text-left text-[11px] font-mono">
                                <thead className="bg-slate-100/60 font-bold border-b border-slate-100 text-slate-500">
                                  <tr>
                                    <th className="py-2.5 px-3">Bill ID</th>
                                    <th className="py-2.5 px-3">Dispensed Medicine</th>
                                    <th className="py-2.5 px-3 text-center">Qty</th>
                                    <th className="py-2.5 px-3 text-right">Unit MRP</th>
                                    <th className="py-2.5 px-3 text-right">Discount</th>
                                    <th className="py-2.5 px-3 text-right">Net Sale</th>
                                    <th className="py-2.5 px-3 text-right">Estimated Cost Price</th>
                                    <th className="py-2.5 px-3 text-right">Net Profit Contribution</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                  {day.salesDetails.map((detail, dIdx) => (
                                    <tr key={dIdx} className="hover:bg-slate-50/30">
                                      <td className="py-2 px-3 font-semibold text-slate-700">{detail.id}</td>
                                      <td className="py-2 px-3 font-semibold text-slate-800 font-sans">{detail.medicineName}</td>
                                      <td className="py-2 px-3 text-center font-bold text-slate-700">{detail.quantity}</td>
                                      <td className="py-2 px-3 text-right">₹{detail.price.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right text-rose-500">{detail.discount}%</td>
                                      <td className="py-2 px-3 text-right font-semibold text-slate-800">₹{detail.totalAmount.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right text-slate-400">₹{(detail.costPrice * detail.quantity).toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right text-emerald-600 font-bold">₹{detail.profit.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
