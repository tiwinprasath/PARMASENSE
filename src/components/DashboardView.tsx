/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MedicineMaster, InventoryItem, Sale, Supplier, Notification } from '../types';
import { 
  Package, AlertTriangle, ShieldCheck, TrendingUp, DollarSign, 
  ShoppingCart, Users, Truck, Clock, Calendar, CheckCircle2,
  ChevronRight, ArrowUpRight, Award, Flame, Snowflake, ListFilter
} from 'lucide-react';

interface DashboardViewProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  sales: Sale[];
  suppliers: Supplier[];
  notifications: Notification[];
  onMarkNotificationAsRead: (id: string) => void;
  onClearAllNotifications: () => void;
  onNavigateToTab: (tab: string) => void;
  currentSystemDate: string;
}

export default function DashboardView({
  medicines,
  inventory,
  sales,
  suppliers,
  notifications,
  onMarkNotificationAsRead,
  onClearAllNotifications,
  onNavigateToTab,
  currentSystemDate
}: DashboardViewProps) {
  const [selectedMonthRange, setSelectedMonthRange] = useState<'all' | '6m' | '3m'>('all');
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('unread');

  // 1. Calculate Core KPI Cards
  const stats = useMemo(() => {
    const totalMeds = medicines.length;
    const totalStockQty = inventory.reduce((sum, item) => sum + item.currentQuantity, 0);
    const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.currentQuantity * item.purchasePrice), 0);
    
    // Low Stock Items (currentQuantity <= reorderLevel, excluding expired/0 qty which is counted separately)
    const lowStockCount = inventory.filter(item => item.currentQuantity <= item.reorderLevel && item.currentQuantity > 0 && item.status !== 'Expired').length;
    const outOfStockCount = inventory.filter(item => item.currentQuantity === 0).length;
    
    // Expiry classifications (relative to current system date)
    const currentDate = new Date(currentSystemDate);
    let expiredCount = 0;
    let nearExpiry30Count = 0;
    let nearExpiry90Count = 0;
    let nearExpiry180Count = 0;

    inventory.forEach(item => {
      const expDate = new Date(item.expiryDate);
      const diffTime = expDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        expiredCount++;
      } else if (diffDays <= 30) {
        nearExpiry30Count++;
      } else if (diffDays <= 90) {
        nearExpiry90Count++;
      } else if (diffDays <= 180) {
        nearExpiry180Count++;
      }
    });

    // Sales Calculations
    const totalSalesAmt = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    // Profit Calculation (Sales Total - Purchase Cost for items sold)
    const totalProfit = sales.reduce((sum, s) => {
      const invItem = inventory.find(i => i.medicineId === s.medicineId);
      const purchasePrice = invItem ? invItem.purchasePrice : s.price * 0.5; // Fallback to 50% margin if not found
      const costOfGoodsSold = purchasePrice * s.quantity;
      const profitOnSale = s.totalAmount - costOfGoodsSold;
      return sum + profitOnSale;
    }, 0);

    return {
      totalMeds,
      totalStockQty,
      totalInventoryValue,
      lowStockCount,
      outOfStockCount,
      expiredCount,
      nearExpiry30Count,
      nearExpiry90Count,
      nearExpiry180Count,
      totalSalesAmt,
      totalProfit
    };
  }, [medicines, inventory, sales]);

  // 2. Sales Trend Data calculation for SVG Chart (last 12 months)
  const monthlySalesData = useMemo(() => {
    const months = ["Jul '25", "Aug '25", "Sep '25", "Oct '25", "Nov '25", "Dec '25", "Jan '26", "Feb '26", "Mar '26", "Apr '26", "May '26", "Jun '26"];
    const monthKeys = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
    
    const revenues = monthKeys.map(key => {
      return sales
        .filter(s => s.date.startsWith(key))
        .reduce((sum, s) => sum + s.totalAmount, 0);
    });

    const profits = monthKeys.map((key, index) => {
      return sales
        .filter(s => s.date.startsWith(key))
        .reduce((sum, s) => {
          const invItem = inventory.find(i => i.medicineId === s.medicineId);
          const cost = invItem ? invItem.purchasePrice : s.price * 0.5;
          return sum + (s.totalAmount - (cost * s.quantity));
        }, 0);
    });

    let slicedMonths = months;
    let slicedRevenues = revenues;
    let slicedProfits = profits;

    if (selectedMonthRange === '6m') {
      slicedMonths = months.slice(6);
      slicedRevenues = revenues.slice(6);
      slicedProfits = profits.slice(6);
    } else if (selectedMonthRange === '3m') {
      slicedMonths = months.slice(9);
      slicedRevenues = revenues.slice(9);
      slicedProfits = profits.slice(9);
    }

    return {
      labels: slicedMonths,
      revenues: slicedRevenues,
      profits: slicedProfits
    };
  }, [sales, inventory, selectedMonthRange]);

  // 3. Category distribution (Donut chart representation)
  const categoryData = useMemo(() => {
    const categories: { [key: string]: number } = {};
    sales.forEach(sale => {
      const med = medicines.find(m => m.id === sale.medicineId);
      if (med) {
        categories[med.category] = (categories[med.category] || 0) + sale.totalAmount;
      }
    });

    const sortedCategories = Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5 categories

    const otherSum = Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(5)
      .reduce((sum, item) => sum + item.value, 0);

    if (otherSum > 0) {
      sortedCategories.push({ name: 'Others', value: otherSum });
    }

    const total = sortedCategories.reduce((sum, item) => sum + item.value, 0);
    return sortedCategories.map(item => ({
      ...item,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0
    }));
  }, [sales, medicines]);

  // 4. Filter notifications based on unread selection
  const filteredNotifications = useMemo(() => {
    const filtered = notifications.filter(n => {
      if (notificationFilter === 'unread') return !n.isRead;
      return true;
    });
    return filtered.slice(0, 8); // show up to 8 notifications
  }, [notifications, notificationFilter]);

  // 5. Shortage critical recommendations list (top 4)
  const shortageRecommendations = useMemo(() => {
    return inventory
      .filter(item => item.currentQuantity <= item.reorderLevel && item.status !== 'Expired')
      .map(item => {
        const med = medicines.find(m => m.id === item.medicineId);
        const supplier = suppliers.find(s => s.id === item.supplierId);
        
        // Estimated Days Remaining = currentQuantity / average sales per day (mock default is 2)
        const avgDailySales = 2.5;
        const daysRemaining = Math.max(0, Math.round(item.currentQuantity / avgDailySales));
        const requiredQty = item.maximumStock - item.currentQuantity;

        return {
          id: item.id,
          name: med?.name || 'Unknown',
          genericName: med?.genericName || '',
          currentQuantity: item.currentQuantity,
          reorderLevel: item.reorderLevel,
          daysRemaining,
          requiredQty,
          preferredSupplier: supplier?.companyName || 'Not Assigned',
          status: item.currentQuantity === 0 ? 'Out of Stock' : 'Low Stock'
        };
      })
      .sort((a, b) => a.currentQuantity - b.currentQuantity)
      .slice(0, 4);
  }, [inventory, medicines, suppliers]);

  // 6. Expiry critical alerts
  const nearExpiryList = useMemo(() => {
    const currentDate = new Date('2026-07-07');
    return inventory
      .filter(item => {
        const expDate = new Date(item.expiryDate);
        const diffTime = expDate.getTime() - currentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 90; // Expiring in 90 days
      })
      .map(item => {
        const med = medicines.find(m => m.id === item.medicineId);
        const expDate = new Date(item.expiryDate);
        const diffTime = expDate.getTime() - currentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Suggest generic discount if expiring soon
        const suggestedDiscount = diffDays <= 30 ? 30 : diffDays <= 60 ? 15 : 10;

        return {
          id: item.id,
          name: med?.name || 'Unknown',
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          daysLeft: diffDays,
          currentQuantity: item.currentQuantity,
          suggestedDiscount,
          sellingPrice: item.sellingPrice
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [inventory, medicines]);

  // SVG Chart Height helpers
  const maxRevenue = Math.max(...monthlySalesData.revenues, 10000);
  const chartHeight = 220;
  const chartWidth = 500;

  return (
    <div className="space-y-6" id="dashboard_panel">
      {/* Dynamic Notifications Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Real-time Operations Desk
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Pharmacy Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Core diagnostic metrics, daily audit summaries, and automated stock safety triggers.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Calendar className="h-4.5 w-4.5 text-slate-400" />
          <span className="font-mono text-sm font-semibold text-slate-600">
            Audit Date: 2026-07-07
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Medicines in Formulary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
              <Users className="h-6 w-6 text-emerald-600" />
            </div>
            <span className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
              Active Formulary
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Medicines Registered</p>
            <h3 className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {stats.totalMeds}
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Cataloged Medicines</span>
              <button 
                onClick={() => onNavigateToTab('inventory')}
                className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline flex items-center"
              >
                Catalog <ChevronRight className="h-3 w-3 ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Physical Unit Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-teal-50 p-2.5 rounded-xl border border-teal-100">
              <Package className="h-6 w-6 text-teal-600" />
            </div>
            <span className="flex items-center text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full font-mono">
              Stock Units
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total On-Hand Inventory</p>
            <h3 className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {stats.totalStockQty} <span className="text-sm font-sans font-normal text-slate-500">Units</span>
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Across all warehouse locations</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Near Expiry Batches */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            {(stats.nearExpiry30Count + stats.nearExpiry90Count) > 0 && (
              <span className="animate-pulse flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-mono">
                Expiring Soon
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Near Expiry Batches</p>
            <h3 className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {stats.nearExpiry30Count + stats.nearExpiry90Count + stats.nearExpiry180Count} <span className="text-sm font-sans font-normal text-slate-500">Items</span>
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Expiring within 180 days</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Expiry Warnings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
            </div>
            {stats.expiredCount > 0 && (
              <span className="flex items-center text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-mono">
                Quarantine Now
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Expired Batches</p>
            <h3 className="text-2xl font-mono font-bold text-slate-800 mt-1">
              {stats.expiredCount} <span className="text-sm font-sans font-normal text-slate-500">Expired</span>
            </h3>
            <div className="flex justify-between items-center text-xs text-slate-500 mt-2 border-t border-slate-50 pt-2 font-mono">
              <span>Requires daily sweep audit</span>
              <button 
                onClick={() => onNavigateToTab('profit')}
                className="text-rose-600 hover:text-rose-700 font-semibold hover:underline flex items-center"
              >
                Track & Sweep <ChevronRight className="h-3 w-3 ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Sales Trend (Full layout) */}
      <div className="grid grid-cols-1 gap-6">
        {/* Chart 2: Category distribution (Donut chart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 max-w-md">
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-indigo-600" />
              Category Sales Share
            </h3>
            <p className="text-xs text-slate-400 mt-1">Total purchase share breakdown by therapeutic category</p>
            
            {/* Legends list */}
            <div className="w-full space-y-2 mt-6 max-h-[220px] overflow-y-auto pr-1">
              {categoryData.map((cat, idx) => {
                const colors = ["bg-teal-600", "bg-emerald-500", "bg-indigo-500", "bg-amber-500", "bg-rose-500", "bg-slate-500"];
                const colorClass = colors[idx % colors.length];
                return (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className={`h-2.5 w-2.5 rounded-full ${colorClass} shrink-0`} />
                      <span className="font-medium text-slate-600 truncate">{cat.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-700 whitespace-nowrap">
                      ₹{cat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({cat.percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Donut representation */}
          <div className="flex flex-col justify-center items-center py-2 shrink-0">
            <div className="relative h-44 w-44 flex items-center justify-center">
              {/* SVG Circle representations for the top categories */}
              <svg viewBox="0 0 100 100" className="h-full w-full transform -rotate-90">
                {categoryData.reduce((acc, cat, idx) => {
                  const strokeWidth = 14;
                  const radius = 38;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDasharray = `${(cat.percentage / 100) * circumference} ${circumference}`;
                  
                  // Calculate strokeDashoffset accumulated
                  const accumulatedPercentage = categoryData
                    .slice(0, idx)
                    .reduce((sum, c) => sum + c.percentage, 0);
                  const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);

                  const colors = ["#0d9488", "#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#64748b"];
                  const color = colors[idx % colors.length];

                  acc.push(
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500 hover:stroke-[16px] cursor-pointer"
                    >
                      <title>{`${cat.name}: ${cat.percentage}% (₹${cat.value.toFixed(0)})`}</title>
                    </circle>
                  );
                  return acc;
                }, [] as React.ReactNode[])}
                <circle cx="50" cy="50" r="30" fill="white" />
              </svg>
              <div className="absolute text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Top Share</span>
                <p className="text-sm font-display font-bold text-slate-800 truncate max-w-[80px]">
                  {categoryData[0]?.name || 'N/A'}
                </p>
                <span className="text-xs font-mono font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md">
                  {categoryData[0]?.percentage || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiry Auditing Tracker */}
      <div className="grid grid-cols-1 gap-6">
        {/* Expiry Timeline Warnings & Promo Discounts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-50 pb-4 mb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-rose-500" />
                Near Expiry & Promos
              </h3>
              <p className="text-xs text-slate-400">Medicines with imminent expiration; system suggests discount strategies</p>
            </div>
            <button 
              onClick={() => onNavigateToTab('inventory')}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline"
            >
              Expiry Report
            </button>
          </div>

          {nearExpiryList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <ShieldCheck className="h-10 w-10 text-emerald-500 mb-2" />
              <p className="text-sm font-semibold">Perfect Expiry Clearance</p>
              <p className="text-xs">No batches are expiring in the next 90 days.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nearExpiryList.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 truncate">{item.name}</h4>
                      <span className="font-mono text-[10px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded">
                        Batch {item.batchNumber}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                      <span>Exp: <b className="text-slate-700 font-mono">{item.expiryDate}</b></span>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                        <span className="font-semibold text-rose-600 font-mono">{item.daysLeft} days left</span>
                      </span>
                    </div>

                    {/* Return or Markdown Trigger */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-400">Audit Status:</span>
                      {item.daysLeft <= 30 ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1">
                          <Flame className="h-3 w-3 text-rose-500" />
                          Mark for Supplier Return
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                          <Snowflake className="h-3 w-3 text-amber-500" />
                          Promo Markdown suggested
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 border-slate-100 pt-2.5 sm:pt-0">
                    <span className="text-xs text-slate-400 font-mono">Stock: <b className="text-slate-700">{item.currentQuantity}</b></span>
                    <div className="mt-1 flex flex-col items-end font-mono text-xs">
                      <span className="text-slate-400">Regular: ₹{item.sellingPrice.toFixed(2)}</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        Promo: ₹{(item.sellingPrice * (1 - item.suggestedDiscount / 100)).toFixed(2)}
                        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded">
                          -{item.suggestedDiscount}%
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notification Center panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm" id="notifications_panel">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50 pb-4 mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600" />
              Operational Notifications & Audit Alerts
            </h3>
            <p className="text-xs text-slate-400">System warnings generated dynamically by inventory checks and daily logs</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
              <button
                onClick={() => setNotificationFilter('unread')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${notificationFilter === 'unread' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-500'}`}
              >
                Unread
              </button>
              <button
                onClick={() => setNotificationFilter('all')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${notificationFilter === 'all' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-500'}`}
              >
                All
              </button>
            </div>
            <button
              onClick={onClearAllNotifications}
              className="text-xs text-slate-400 hover:text-rose-600 font-semibold"
            >
              Clear All
            </button>
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="h-8 w-8 text-teal-500 mb-1.5" />
            <p className="text-sm font-semibold">Workspace fully audited</p>
            <p className="text-xs">No pending notifications require attention.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredNotifications.map((noti) => (
              <div 
                key={noti.id} 
                className={`p-4 rounded-xl border transition-all flex gap-3 ${
                  noti.isRead ? 'bg-slate-50/60 border-slate-100 opacity-75' : 
                  noti.severity === 'error' ? 'bg-rose-50/40 border-rose-100 hover:bg-rose-50/70' : 
                  'bg-amber-50/40 border-amber-100 hover:bg-amber-50/70'
                }`}
              >
                <div className={`p-2 rounded-lg h-fit ${
                  noti.severity === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className={`text-sm font-semibold truncate ${noti.isRead ? 'text-slate-500' : 'text-slate-800'}`}>
                      {noti.title}
                    </h4>
                    <span className="font-mono text-[9px] text-slate-400 shrink-0">{noti.date}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{noti.message}</p>
                  
                  {!noti.isRead && (
                    <button 
                      onClick={() => onMarkNotificationAsRead(noti.id)}
                      className="text-[11px] font-bold text-teal-600 hover:text-teal-700 mt-2.5 flex items-center"
                    >
                      Acknowledge & Mark Read <CheckCircle2 className="h-3 w-3 ml-1" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
