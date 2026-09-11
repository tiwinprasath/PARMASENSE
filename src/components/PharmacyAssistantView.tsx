/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MedicineMaster, InventoryItem, Supplier } from '../types';
import { 
  Search, ShieldAlert, Sparkles, Phone, Mail, MapPin, 
  Package, Snowflake, Barcode, ClipboardList, HelpCircle
} from 'lucide-react';
import BarcodeQRScanner from './BarcodeQRScanner';
import PharmacyChatbot from './PharmacyChatbot';

interface PharmacyAssistantViewProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  role: string;
  patientMode?: boolean;
}

export default function PharmacyAssistantView({
  medicines,
  inventory,
  suppliers,
  role,
  patientMode = false
}: PharmacyAssistantViewProps) {
  const [query, setQuery] = useState('');
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Filter medicines based on searching
  const matches = useMemo(() => {
    if (!query.trim()) return medicines.slice(0, 5); // show first few on default
    
    return medicines.filter(m => 
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.genericName.toLowerCase().includes(query.toLowerCase()) ||
      m.brand.toLowerCase().includes(query.toLowerCase()) ||
      m.category.toLowerCase().includes(query.toLowerCase()) ||
      m.manufacturer.toLowerCase().includes(query.toLowerCase()) ||
      m.barcode.includes(query)
    );
  }, [medicines, query]);

  // If search matches but none selected, default to first match
  const selectedMed = useMemo(() => {
    const targetId = selectedMedId || (matches.length > 0 ? matches[0].id : null);
    return medicines.find(m => m.id === targetId) || null;
  }, [selectedMedId, matches, medicines]);

  // Inventory stats for selected med
  const medStats = useMemo(() => {
    if (!selectedMed) return null;

    const batches = inventory.filter(b => b.medicineId === selectedMed.id);
    const totalQty = batches.reduce((sum, b) => sum + b.currentQuantity, 0);
    const expiredBatches = batches.filter(b => {
      const currentDate = new Date('2026-07-07');
      const expDate = new Date(b.expiryDate);
      return expDate.getTime() <= currentDate.getTime();
    });

    const activeBatches = batches.filter(b => {
      const currentDate = new Date('2026-07-07');
      const expDate = new Date(b.expiryDate);
      return expDate.getTime() > currentDate.getTime();
    });

    // Supplier Info
    const primarySupplierId = batches.length > 0 ? batches[0].supplierId : null;
    const supplier = suppliers.find(s => s.id === primarySupplierId) || suppliers[0];

    return {
      totalQty,
      expiredCount: expiredBatches.reduce((sum, b) => sum + b.currentQuantity, 0),
      activeCount: activeBatches.reduce((sum, b) => sum + b.currentQuantity, 0),
      batches,
      supplier
    };
  }, [selectedMed, inventory, suppliers]);

  return (
    <div className="space-y-6">
      <PharmacyChatbot role={role} medicines={medicines} patientMode={patientMode} />
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Clinical Reference
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Pharmacy Assistant Desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Accelerated search workspace for drug availability, chemical formula references, storage temperatures, and logistical suppliers.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Fast Query (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-800">Fast Drug Query</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search drug formula, category, brand..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedMedId(null); }}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowScannerModal(true)}
                className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-teal-400 rounded-xl cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1.5 text-xs font-bold"
                title="AI Neural Scanner & Model Trainer"
              >
                <Sparkles className="h-4 w-4 text-teal-400 animate-pulse" />
                <span className="hidden sm:inline">AI Scanner</span>
              </button>
            </div>

            <div className="space-y-2 mt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Matching Medications</span>
              <div className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto pr-1">
                {matches.map((med) => {
                  const isSelected = selectedMed?.id === med.id;
                  return (
                    <button
                      key={med.id}
                      onClick={() => setSelectedMedId(med.id)}
                      className={`w-full text-left p-3 flex justify-between items-center rounded-xl transition-all ${isSelected ? 'bg-teal-50/70 text-teal-950 font-semibold' : 'hover:bg-slate-50'}`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-800 block truncate">{med.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono italic block truncate">{med.genericName}</span>
                      </div>
                      <span className="text-[9px] font-bold font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        {med.category}
                      </span>
                    </button>
                  );
                })}

                {matches.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-8">No drugs found matching query.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Full Reference sheet (7 Cols) */}
        <div className="lg:col-span-7">
          {selectedMed && medStats ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              
              {/* Reference Sheet Header */}
              <div className="border-b border-slate-50 pb-4">
                <span className="font-mono text-[9px] font-bold uppercase bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded">
                  Clinical reference dossier
                </span>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-2">
                  {selectedMed.name} ({selectedMed.strength})
                </h3>
                <p className="text-xs text-teal-600 font-mono italic font-semibold mt-0.5">Generic compound: {selectedMed.genericName}</p>
              </div>

              {/* Composition details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono border-b border-slate-50 pb-5">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[9px] uppercase">Drug Brand</span>
                  <span className="font-bold text-slate-700 block mt-0.5 truncate">{selectedMed.brand}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[9px] uppercase">Category</span>
                  <span className="font-bold text-slate-700 block mt-0.5 truncate">{selectedMed.category}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[9px] uppercase">Form Unit</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{selectedMed.unit}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block text-[9px] uppercase">Reg MRP</span>
                  <span className="font-bold text-teal-600 block mt-0.5">₹{selectedMed.mrp.toFixed(2)}</span>
                </div>
              </div>

              {/* Physical Inventory counts */}
              {!patientMode && <div className="space-y-3">
                <h4 className="font-display text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="h-4.5 w-4.5 text-teal-600" />
                  Available Physical Stock levels
                </h4>

                <div className="grid grid-cols-3 gap-3 text-center font-mono text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Total Stock</span>
                    <span className="font-bold text-slate-800 text-base mt-1 block">{medStats.totalQty} units</span>
                  </div>
                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                    <span className="text-emerald-600 block text-[10px]">Active Stock</span>
                    <span className="font-bold text-emerald-700 text-base mt-1 block">{medStats.activeCount} units</span>
                  </div>
                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                    <span className="text-rose-600 block text-[10px]">Expired Stock</span>
                    <span className="font-bold text-rose-700 text-base mt-1 block">{medStats.expiredCount} units</span>
                  </div>
                </div>
              </div>}

              {/* Storage & Code attributes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3 text-xs items-center">
                  <Snowflake className="h-5 w-5 text-teal-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 block font-mono text-[9px] uppercase">Storage Instructions</span>
                    <span className="font-semibold text-slate-700 mt-0.5 block">{selectedMed.storageCondition}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex gap-3 text-xs items-center">
                  <Barcode className="h-5 w-5 text-slate-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 block font-mono text-[9px] uppercase">Fulfillment Barcode</span>
                    <span className="font-bold text-slate-700 font-mono mt-0.5 block">{selectedMed.barcode}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="font-display text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <ClipboardList className="h-4.5 w-4.5 text-teal-600" />
                  Therapeutic Indications
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {selectedMed.description}
                </p>
              </div>

              {/* Procurement Primary Supplier */}
              {!patientMode && medStats.supplier && (
                <div className="border-t border-slate-100 pt-5 space-y-3.5">
                  <h4 className="font-display text-sm font-bold text-slate-800">
                    Procurement Supplier Partner
                  </h4>

                  <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100/60 flex flex-col md:flex-row justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-teal-950 text-sm block">{medStats.supplier.companyName}</span>
                      <span className="text-slate-500 mt-1 block">Representative: {medStats.supplier.contactPerson}</span>
                      
                      <div className="space-y-1 mt-3 text-[11px] text-slate-500">
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" /> {medStats.supplier.contactNumber}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" /> {medStats.supplier.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 border-teal-100/40 pt-2.5 md:pt-0">
                      <span className="text-slate-400 font-mono">Fulfillment Rating:</span>
                      <span className="font-mono text-emerald-700 font-extrabold text-sm block mt-0.5">
                        {medStats.supplier.rating.toFixed(1)} / 5.0
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center text-slate-400 h-full min-h-[400px]">
              <HelpCircle className="h-12 w-12 text-slate-200 mb-2" />
              <p className="text-sm font-semibold">Select a Medicine</p>
              <p className="text-xs max-w-xs mt-1">Search the master catalogue on the left side to load up full reference worksheets and warehouse shelf values.</p>
            </div>
          )}
        </div>
      </div>

      {showScannerModal && (
        <BarcodeQRScanner 
          onScanMatch={(result) => {
            setQuery(result.name);
            setShowScannerModal(false);
          }} 
          onClose={() => setShowScannerModal(false)}
          medicines={medicines}
        />
      )}

    </div>
  );
}
