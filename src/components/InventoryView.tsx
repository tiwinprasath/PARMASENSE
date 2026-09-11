/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MedicineMaster, InventoryItem, Supplier } from '../types';
import { 
  Search, Plus, Filter, ArrowUpDown, Calendar, HelpCircle, 
  Settings, CheckCircle2, AlertTriangle, AlertCircle, Trash, Edit, RefreshCw,
  Barcode, Sparkles
} from 'lucide-react';
import BarcodeQRScanner from './BarcodeQRScanner';

interface InventoryViewProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  readOnly?: boolean;
  onAddMedicine: (med: Omit<MedicineMaster, 'id'>) => void;
  onAddInventoryBatch: (item: Omit<InventoryItem, 'id' | 'status'>) => void;
  onRemoveBatch: (id: string) => void;
  currentSystemDate: string;
}

export default function InventoryView({
  medicines,
  inventory,
  suppliers,
  readOnly = false,
  onAddMedicine,
  onAddInventoryBatch,
  onRemoveBatch,
  currentSystemDate
}: InventoryViewProps) {
  // Navigation inside Inventory tab
  const [activeSubTab, setActiveSubTab] = useState<'master' | 'batches' | 'optimization'>('master');
  
  // Searching & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // New Medicine Form modal state
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [newMed, setNewMed] = useState({
    name: '',
    genericName: '',
    brand: '',
    manufacturer: '',
    category: 'Analgesic & Antipyretic',
    strength: '',
    unit: 'Tablet',
    mrp: 10,
    gst: 12,
    storageCondition: 'Store below 25°C',
    barcode: '',
    description: ''
  });

  // New Batch Form modal state
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [newBatch, setNewBatch] = useState({
    medicineId: '',
    batchNumber: '',
    manufacturingDate: '2025-06-01',
    expiryDate: '2027-06-01',
    purchaseDate: '2025-07-01',
    currentQuantity: 100,
    minimumStock: 20,
    maximumStock: 500,
    reorderLevel: 50,
    supplierId: '',
    purchasePrice: 5.00,
    sellingPrice: 10.00,
    warehouseLocation: 'Shelf A1'
  });

  // EOQ Interactive Simulator Variables
  const [annualDemand, setAnnualDemand] = useState(2400); // units/year
  const [orderCost, setOrderCost] = useState(150); // setup cost per order
  const [holdingCost, setHoldingCost] = useState(12); // holding cost percentage (e.g. 12% of purchase price)

  // Pre-selected medicine categories
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(medicines.map(m => m.category)))];
  }, [medicines]);

  // Master List Filter
  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      const matchSearch = 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === 'All' || m.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [medicines, searchTerm, categoryFilter]);

  // Batches List Filter
  const filteredBatches = useMemo(() => {
    return inventory.map(item => {
      const med = medicines.find(m => m.id === item.medicineId);
      return { ...item, medicine: med };
    }).filter(b => {
      const matchSearch = 
        b.medicine?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.medicine?.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchCategory = categoryFilter === 'All' || b.medicine?.category === categoryFilter;
      
      // Calculate active status relative to current system date
      const currentDate = new Date(currentSystemDate);
      const expDate = new Date(b.expiryDate);
      const diffDays = Math.ceil((expDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let calculatedStatus = 'Safe';
      if (diffDays <= 0) {
        calculatedStatus = 'Expired';
      } else if (diffDays <= 90) {
        calculatedStatus = 'Near Expiry';
      } else if (b.currentQuantity <= b.reorderLevel) {
        calculatedStatus = 'Low Stock';
      }

      const matchStatus = 
        statusFilter === 'All' || 
        (statusFilter === 'Expired' && calculatedStatus === 'Expired') ||
        (statusFilter === 'Near Expiry' && calculatedStatus === 'Near Expiry') ||
        (statusFilter === 'Low Stock' && calculatedStatus === 'Low Stock') ||
        (statusFilter === 'In Stock' && calculatedStatus === 'Safe');

      return matchSearch && matchCategory && matchStatus;
    });
  }, [inventory, medicines, searchTerm, categoryFilter, statusFilter]);

  // MODULE 5: ABC & EOQ Calculations
  // ABC Analysis classifies medicines into:
  // - A (High Value): Top 75% of cumulative inventory valuation
  // - B (Medium Value): Middle 15% of valuation
  // - C (Low Value): Bottom 10% of valuation
  const abcAnalysis = useMemo(() => {
    const itemsWithValue = medicines.map(med => {
      const batches = inventory.filter(i => i.medicineId === med.id);
      const qty = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
      const avgPrice = batches.length > 0 ? batches[0].purchasePrice : med.mrp * 0.5;
      const valuation = qty * avgPrice;
      return { med, qty, valuation };
    });

    // Sort by valuation descending
    itemsWithValue.sort((a, b) => b.valuation - a.valuation);
    const totalValuation = itemsWithValue.reduce((sum, x) => sum + x.valuation, 0) || 1;

    let cumulativeVal = 0;
    return itemsWithValue.map(item => {
      cumulativeVal += item.valuation;
      const share = cumulativeVal / totalValuation;
      let classification: 'A' | 'B' | 'C' = 'C';
      if (share <= 0.75) classification = 'A';
      else if (share <= 0.90) classification = 'B';

      return {
        ...item,
        percentageVal: Math.round((item.valuation / totalValuation) * 100),
        classification
      };
    });
  }, [medicines, inventory]);

  // EOQ Calculations helper
  const calculatedEOQ = useMemo(() => {
    // EOQ = sqrt((2 * D * S) / H)
    // S = orderCost, D = annualDemand, H = holdingCost per unit per year.
    // Assuming an average item price of ₹50
    const avgItemPrice = 50;
    const hUnit = (holdingCost / 100) * avgItemPrice;
    const eoq = Math.round(Math.sqrt((2 * annualDemand * orderCost) / (hUnit || 1)));
    const annualOrders = Math.round(annualDemand / (eoq || 1));
    return { eoq, annualOrders };
  }, [annualDemand, orderCost, holdingCost]);

  // Understock & Overstock items for Module 5 report cards
  const stockOverUnderStats = useMemo(() => {
    const under = inventory.filter(i => i.currentQuantity <= i.minimumStock && i.status !== 'Expired');
    const over = inventory.filter(i => i.currentQuantity >= i.maximumStock && i.status !== 'Expired');
    return { under, over };
  }, [inventory]);

  const handleMedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddMedicine(newMed);
    setShowAddMedModal(false);
    // Reset form
    setNewMed({
      name: '',
      genericName: '',
      brand: '',
      manufacturer: '',
      category: 'Analgesic & Antipyretic',
      strength: '',
      unit: 'Tablet',
      mrp: 10,
      gst: 12,
      storageCondition: 'Store below 25°C',
      barcode: '',
      description: ''
    });
  };

  const handleScanMatch = (result: any) => {
    setNewMed({
      name: result.name,
      genericName: result.genericName,
      brand: result.name,
      manufacturer: result.manufacturer,
      category: result.category,
      strength: result.strength,
      unit: result.unit,
      mrp: result.mrp,
      gst: 12,
      storageCondition: 'Store below 25°C',
      barcode: result.barcode,
      description: result.description
    });
    setShowScannerModal(false);
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddInventoryBatch(newBatch);
    setShowAddBatchModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header & Quick Add bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Inventory Central
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Smart Inventory Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain the drug formulary, track multi-batch physical stock layers, and run automated optimization parameters.
          </p>
        </div>

        {/* Local Tab Navigation */}
        <div className="flex overflow-x-auto max-w-full w-full sm:w-auto bg-slate-100 p-1 rounded-xl border border-slate-200/50 shrink-0">
          <button
            onClick={() => setActiveSubTab('master')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${activeSubTab === 'master' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Medicine Master ({medicines.length})
          </button>
          <button
            onClick={() => setActiveSubTab('batches')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${activeSubTab === 'batches' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Batch Registry ({inventory.length})
          </button>
          <button
            onClick={() => setActiveSubTab('optimization')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${activeSubTab === 'optimization' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Optimization Lab
          </button>
        </div>
      </div>

      {/* SubTab 1: Medicine Master */}
      {activeSubTab === 'master' && (
        <div className="space-y-4">
          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search brand, generic name, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-semibold focus:outline-none focus:border-teal-500"
              >
                {categories.map((cat, i) => (
                  <option key={i} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
                ))}
              </select>
            </div>

            {!readOnly && (
              <button
                onClick={() => setShowAddMedModal(true)}
                className="flex items-center justify-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs cursor-pointer transition-all shrink-0"
              >
                <Plus className="h-4.5 w-4.5" />
                Add Medicine
              </button>
            )}
          </div>

          {/* Grid Layout of Medicines */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMedicines.map((med) => {
              // Get stock details for this medicine
              const batches = inventory.filter(b => b.medicineId === med.id);
              const totalStock = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
              const expiredBatchesCount = batches.filter(b => b.status === 'Expired').length;
              
              return (
                <div key={med.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold">
                        {med.id}
                      </span>
                      <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full uppercase">
                        {med.category}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-slate-800 mt-2">{med.name}</h3>
                    <p className="text-xs text-slate-400 italic font-mono mt-0.5 line-clamp-1">{med.genericName}</p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-mono border-t border-b border-slate-50 py-3">
                      <div>
                        <span className="text-slate-400 block">Manufacturer:</span>
                        <span className="font-semibold text-slate-600 truncate block">{med.manufacturer}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Strength/Unit:</span>
                        <span className="font-semibold text-slate-600">{med.strength} / {med.unit}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400 block">Total Physical Stock:</span>
                      <span className={`font-mono text-sm font-bold ${totalStock === 0 ? 'text-rose-500' : totalStock <= 50 ? 'text-amber-500' : 'text-slate-700'}`}>
                        {totalStock} units
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-slate-400 block">MRP per unit:</span>
                      <span className="font-bold text-slate-800 text-sm">₹{med.mrp.toFixed(2)}</span>
                    </div>
                  </div>

                  {expiredBatchesCount > 0 && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 text-[11px] p-2 rounded-lg mt-3 flex items-center gap-1.5 font-semibold">
                      <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                      Contains {expiredBatchesCount} EXPIRED batches!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SubTab 2: Batch Registry */}
      {activeSubTab === 'batches' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by brand name or batch number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600 font-semibold focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="In Stock">Safe In Stock</option>
                <option value="Low Stock">Needs Reorder</option>
                <option value="Near Expiry">Near Expiry (&lt;90 Days)</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <button
              onClick={() => {
                if (medicines.length === 0) {
                  alert("Please add at least one medicine in the master tab before adding a stock batch.");
                  return;
                }
                setNewBatch(prev => ({ ...prev, medicineId: medicines[0].id, supplierId: suppliers[0]?.id || '' }));
                setShowAddBatchModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer transition-all shrink-0 animate-pulse"
            >
              <Plus className="h-4.5 w-4.5" />
              New Stock Batch
            </button>
          </div>

          {/* Batches Table List */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">Medicine details</th>
                    <th className="px-6 py-4 font-mono">Batch / Shelf</th>
                    <th className="px-6 py-4 font-mono">Expiry / Age</th>
                    <th className="px-6 py-4 text-right font-mono">Stock Qty</th>
                    <th className="px-6 py-4 text-right font-mono">Pricing (Cost/Sell)</th>
                    <th className="px-6 py-4 text-center">Audit Tag</th>
                    <th className="px-6 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredBatches.map((item) => {
                    // Days left calculator
                    const currentDate = new Date('2026-07-07');
                    const expDate = new Date(item.expiryDate);
                    const diffDays = Math.ceil((expDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    let tagClass = 'bg-teal-50 text-teal-700 border border-teal-100';
                    let label = 'Safe';
                    if (diffDays <= 0) {
                      tagClass = 'bg-rose-50 text-rose-700 border border-rose-100';
                      label = 'Expired';
                    } else if (diffDays <= 90) {
                      tagClass = 'bg-amber-50 text-amber-700 border border-amber-100';
                      label = `Expiring in ${diffDays}d`;
                    } else if (item.currentQuantity <= item.reorderLevel) {
                      tagClass = 'bg-amber-100/70 text-amber-800 border border-amber-200';
                      label = 'Low Stock';
                    }

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                        {/* Medicine */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">{item.medicine?.name}</div>
                          <span className="text-[10px] text-slate-400 font-mono italic">{item.medicine?.genericName}</span>
                        </td>

                        {/* Batch/Shelf */}
                        <td className="px-6 py-4 font-mono text-slate-600">
                          <span className="font-bold text-slate-700 block">{item.batchNumber}</span>
                          <span className="text-[10px] text-slate-400 block">{item.warehouseLocation}</span>
                        </td>

                        {/* Expiry */}
                        <td className="px-6 py-4 font-mono">
                          <span className={`${diffDays <= 0 ? 'text-rose-600 font-bold' : diffDays <= 90 ? 'text-amber-600 font-bold' : 'text-slate-600'}`}>
                            {item.expiryDate}
                          </span>
                          <span className="text-[10px] text-slate-400 block">Mfg: {item.manufacturingDate}</span>
                        </td>

                        {/* Qty */}
                        <td className="px-6 py-4 text-right font-mono font-bold text-sm text-slate-700">
                          {item.currentQuantity} units
                        </td>

                        {/* Costs */}
                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                          <div>Cost: ₹{item.purchasePrice.toFixed(2)}</div>
                          <div className="font-bold text-teal-600">Sell: ₹{item.sellingPrice.toFixed(2)}</div>
                        </td>

                        {/* Status Tag */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block font-mono text-[9px] font-bold px-2 py-0.5 rounded-full ${tagClass}`}>
                            {label}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-center">
                          {!readOnly && (
                            <button
                              onClick={() => onRemoveBatch(item.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Quarantine & Remove Batch"
                            >
                              <Trash className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredBatches.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                        No batches matched your filter conditions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Optimization Lab (EOQ & ABC & Limits) */}
      {activeSubTab === 'optimization' && (
        <div className="space-y-6">
          {/* Overstock & Understock Alert Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Understocked Batches Card */}
            <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs">
              <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                Understock Report (current &lt;= minimum stock)
              </h3>
              
              {stockOverUnderStats.under.length === 0 ? (
                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-lg font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Perfect, no safety level violations!
                </p>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {stockOverUnderStats.under.map((item, i) => {
                    const med = medicines.find(m => m.id === item.medicineId);
                    return (
                      <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-rose-50/50 rounded-lg border border-rose-100/55">
                        <div>
                          <span className="font-semibold text-slate-800">{med?.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 block">Batch: {item.batchNumber}</span>
                        </div>
                        <div className="text-right font-mono text-rose-700 font-bold">
                          Qty: {item.currentQuantity} <span className="text-[10px] font-normal text-slate-400">(Min: {item.minimumStock})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Overstocked Batches Card */}
            <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs">
              <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                <HelpCircle className="h-5 w-5 text-amber-500" />
                Overstock Report (current &gt;= maximum stock)
              </h3>
              
              {stockOverUnderStats.over.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg font-semibold">
                  No overstocked items. Capital matches stock targets.
                </p>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {stockOverUnderStats.over.map((item, i) => {
                    const med = medicines.find(m => m.id === item.medicineId);
                    return (
                      <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-amber-50/50 rounded-lg border border-amber-100/50">
                        <div>
                          <span className="font-semibold text-slate-800">{med?.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 block">Batch: {item.batchNumber}</span>
                        </div>
                        <div className="text-right font-mono text-amber-700 font-bold">
                          Qty: {item.currentQuantity} <span className="text-[10px] font-normal text-slate-400">(Max: {item.maximumStock})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Interactive EOQ Calculator & ABC Classification Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* EOQ Calculator Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3 mb-4">
                  <Settings className="h-5 w-5 text-teal-600 animate-spin-slow" />
                  Economic Order Quantity (EOQ)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Calculate target lot sizes to minimize combined annual holding and procurement overheads.
                </p>

                {/* Inputs */}
                <div className="space-y-4.5 mt-5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block uppercase mb-1">Annual Combined Demand (D)</label>
                    <input
                      type="number"
                      value={annualDemand}
                      onChange={(e) => setAnnualDemand(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block uppercase mb-1">Procurement Cost Per Order (S)</label>
                    <input
                      type="number"
                      value={orderCost}
                      onChange={(e) => setOrderCost(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block uppercase mb-1">Annual Carrying Cost Percentage (H)</label>
                    <input
                      type="number"
                      value={holdingCost}
                      onChange={(e) => setHoldingCost(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Outputs */}
              <div className="bg-teal-50 border border-teal-100/60 rounded-xl p-4 mt-6 text-center">
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">Recommended Optimum Order Size</span>
                <span className="font-mono text-3xl font-extrabold text-teal-950 block mt-1">
                  {calculatedEOQ.eoq} <span className="text-sm font-sans font-normal text-teal-700">units / order</span>
                </span>
                <span className="text-[11px] text-teal-600 font-medium block mt-2">
                  Optimal Frequency: <b>{calculatedEOQ.annualOrders}</b> replenishments per fiscal year.
                </span>
              </div>
            </div>

            {/* ABC Classification Table */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2">
              <h3 className="font-display text-base font-bold text-slate-800 border-b border-slate-50 pb-3 mb-4">
                ABC Inventory Classification Analysis
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Categorizes your portfolio into three priorities. 
                <span className="font-bold text-rose-600"> Class A: </span> High valuation (Top 75% budget value, needs tight audits).
                <span className="font-bold text-amber-600"> Class B: </span> Moderate value (15%).
                <span className="font-bold text-teal-600"> Class C: </span> Low value (10%).
              </p>

              <div className="overflow-y-auto max-h-[300px] border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 font-mono">
                      <th className="px-4 py-3">Medicine Name</th>
                      <th className="px-4 py-3 text-right">In Stock</th>
                      <th className="px-4 py-3 text-right">Procurement Value</th>
                      <th className="px-4 py-3 text-center">ABC class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {abcAnalysis.map((item, i) => {
                      const badgeClass = 
                        item.classification === 'A' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                        item.classification === 'B' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-teal-50 text-teal-700 border border-teal-100';

                      return (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-slate-800 block">{item.med.name}</span>
                            <span className="text-[10px] text-slate-400 block">{item.med.category}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-600">
                            {item.qty}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-800">
                            ₹{item.valuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                              Class {item.classification}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add Medicine Master Modal */}
      {showAddMedModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-teal-50 px-6 py-4 border-b border-teal-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-teal-950 text-base">Add New Medicine to Master</h3>
              <button onClick={() => setShowAddMedModal(false)} className="text-teal-900 hover:text-teal-950 text-xs font-bold font-mono">✕</button>
            </div>
            
            <form onSubmit={handleMedSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Brand Name*</label>
                  <input
                    type="text" required
                    placeholder="e.g. Dolo 650"
                    value={newMed.name}
                    onChange={(e) => setNewMed({...newMed, name: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Generic Formula*</label>
                  <input
                    type="text" required
                    placeholder="e.g. Paracetamol"
                    value={newMed.genericName}
                    onChange={(e) => setNewMed({...newMed, genericName: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Category*</label>
                  <select
                    value={newMed.category}
                    onChange={(e) => setNewMed({...newMed, category: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="Analgesic & Antipyretic">Analgesic & Antipyretic</option>
                    <option value="Antibiotics">Antibiotics</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Antihypertensive">Antihypertensive</option>
                    <option value="Cardiovascular">Cardiovascular</option>
                    <option value="Cough & Cold">Cough & Cold</option>
                    <option value="Antihistamine">Antihistamine</option>
                    <option value="Vitamins & Supplements">Vitamins & Supplements</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Respiratory">Respiratory</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Manufacturer*</label>
                  <input
                    type="text" required
                    placeholder="e.g. Cipla Ltd"
                    value={newMed.manufacturer}
                    onChange={(e) => setNewMed({...newMed, manufacturer: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Strength</label>
                  <input
                    type="text" placeholder="e.g. 500mg"
                    value={newMed.strength}
                    onChange={(e) => setNewMed({...newMed, strength: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Unit</label>
                  <input
                    type="text" placeholder="e.g. Tablet"
                    value={newMed.unit}
                    onChange={(e) => setNewMed({...newMed, unit: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">MRP per Unit*</label>
                  <input
                    type="number" step="0.01" required
                    value={newMed.mrp}
                    onChange={(e) => setNewMed({...newMed, mrp: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                  Product Barcode / QR Identification
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Enter barcode or scan with AI"
                      value={newMed.barcode}
                      onChange={(e) => setNewMed({...newMed, barcode: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition-all shrink-0"
                  >
                    <Sparkles className="h-4 w-4 text-teal-400 animate-pulse" />
                    Scan AI Model
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Description</label>
                <textarea
                  placeholder="Describe standard dosage, usage indicators..."
                  value={newMed.description}
                  onChange={(e) => setNewMed({...newMed, description: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg h-20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
                >
                  Save Master Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Inventory Batch Modal */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-teal-50 px-6 py-4 border-b border-teal-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-teal-950 text-base">Register Inward Physical Stock Batch</h3>
              <button onClick={() => setShowAddBatchModal(false)} className="text-teal-900 hover:text-teal-950 text-xs font-bold font-mono">✕</button>
            </div>
            
            <form onSubmit={handleBatchSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Select Medicine*</label>
                  <select
                    value={newBatch.medicineId}
                    onChange={(e) => setNewBatch({...newBatch, medicineId: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none"
                  >
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Batch Number*</label>
                  <input
                    type="text" required
                    placeholder="e.g. B-9981"
                    value={newBatch.batchNumber}
                    onChange={(e) => setNewBatch({...newBatch, batchNumber: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Mfg Date*</label>
                  <input
                    type="date" required
                    value={newBatch.manufacturingDate}
                    onChange={(e) => setNewBatch({...newBatch, manufacturingDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Expiry Date*</label>
                  <input
                    type="date" required
                    value={newBatch.expiryDate}
                    onChange={(e) => setNewBatch({...newBatch, expiryDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Purchase Date*</label>
                  <input
                    type="date" required
                    value={newBatch.purchaseDate}
                    onChange={(e) => setNewBatch({...newBatch, purchaseDate: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Current Qty*</label>
                  <input
                    type="number" required
                    value={newBatch.currentQuantity}
                    onChange={(e) => setNewBatch({...newBatch, currentQuantity: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Reorder Threshold*</label>
                  <input
                    type="number" required
                    value={newBatch.reorderLevel}
                    onChange={(e) => setNewBatch({...newBatch, reorderLevel: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Maximum Cap</label>
                  <input
                    type="number" required
                    value={newBatch.maximumStock}
                    onChange={(e) => setNewBatch({...newBatch, maximumStock: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Purchase Cost*</label>
                  <input
                    type="number" step="0.01" required
                    value={newBatch.purchasePrice}
                    onChange={(e) => setNewBatch({...newBatch, purchasePrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Selling Price*</label>
                  <input
                    type="number" step="0.01" required
                    value={newBatch.sellingPrice}
                    onChange={(e) => setNewBatch({...newBatch, sellingPrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Warehouse Location</label>
                  <input
                    type="text" required
                    placeholder="e.g. Shelf B2"
                    value={newBatch.warehouseLocation}
                    onChange={(e) => setNewBatch({...newBatch, warehouseLocation: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Supplier Assignee*</label>
                  <select
                    value={newBatch.supplierId}
                    onChange={(e) => setNewBatch({...newBatch, supplierId: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.companyName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddBatchModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
                >
                  Confirm Inward Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScannerModal && (
        <BarcodeQRScanner 
          onScanMatch={handleScanMatch} 
          onClose={() => setShowScannerModal(false)} 
          medicines={medicines}
        />
      )}
    </div>
  );
}
