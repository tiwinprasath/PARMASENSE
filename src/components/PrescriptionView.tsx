/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Prescription, MedicineMaster, InventoryItem } from '../types';
import { 
  FileText, Upload, CheckCircle2, AlertTriangle, HelpCircle, 
  Sparkles, ShoppingCart, ArrowRight, ArrowLeftRight, Check, CheckCircle
} from 'lucide-react';

interface PrescriptionViewProps {
  prescriptions: Prescription[];
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  onDispensePrescription: (prescriptionId: string, itemsToCart: Array<{ medicine: MedicineMaster; batch: InventoryItem; quantity: number }>) => void;
  onNavigateToTab: (tab: string) => void;
}

export default function PrescriptionView({
  prescriptions,
  medicines,
  inventory,
  onDispensePrescription,
  onNavigateToTab
}: PrescriptionViewProps) {
  const [selectedPrxId, setSelectedPrxId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dispenseSuccess, setDispenseSuccess] = useState(false);

  // Simulated Prescriptions that can be loaded on click
  const PRESET_UPLOADS = [
    {
      id: "SIM-PRX-101",
      patientName: "Devendra Mishra",
      patientContact: "+91 98989 12345",
      doctorName: "Dr. Rita Abraham (Endocrinologist)",
      date: "2026-07-07",
      medicines: [
        { name: "Metformin 500", strength: "500mg", qty: 30 },
        { name: "Amlodipine 5", strength: "5mg", qty: 15 }
      ],
      description: "Dr. Rita Abraham - General Diabetes & Blood Pressure prescription.",
      fileName: "rx_mishra_diabetes.pdf"
    },
    {
      id: "SIM-PRX-102",
      patientName: "Karan Johar",
      patientContact: "+91 88888 22222",
      doctorName: "Dr. S. K. Singh (MD)",
      date: "2026-07-07",
      medicines: [
        { name: "Amoxicillin 500", strength: "500mg", qty: 10 },
        { name: "Pantoprazole 40", strength: "40mg", qty: 10 } // Pantoprazole 40 is out of stock! Suggest alternatives!
      ],
      description: "Dr. S. K. Singh - Acid Reflux & Antibiotic prescription.",
      fileName: "rx_karan_gerd.jpg"
    }
  ];

  // Selected Prescription Details
  const selectedPrx = useMemo(() => {
    if (!selectedPrxId) return null;
    
    // Look first in main prescriptions
    let prx = prescriptions.find(p => p.id === selectedPrxId);
    if (!prx) {
      // Look in preset simulation list
      const sim = PRESET_UPLOADS.find(s => s.id === selectedPrxId);
      if (sim) {
        prx = {
          id: sim.id,
          patientName: sim.patientName,
          patientContact: sim.patientContact,
          doctorName: sim.doctorName,
          date: sim.date,
          medicines: sim.medicines,
          status: 'Pending'
        };
      }
    }
    return prx;
  }, [selectedPrxId, prescriptions]);

  // Inventory matching & generic alternative recommendations
  const matchedDispenseList = useMemo(() => {
    if (!selectedPrx) return [];

    return selectedPrx.medicines.map(item => {
      // 1. Try to find exact medicine in master list by name (brand name match or generic match)
      const exactMed = medicines.find(m => 
        m.name.toLowerCase().includes(item.name.toLowerCase()) || 
        m.genericName.toLowerCase().includes(item.name.toLowerCase())
      );

      // Check stock for exact match
      let exactBatches = exactMed ? inventory.filter(b => b.medicineId === exactMed.id && b.currentQuantity > 0 && b.status !== 'Expired') : [];
      exactBatches.sort((a, b) => b.currentQuantity - a.currentQuantity); // pick batch with highest stock

      let alternativeMed: MedicineMaster | null = null;
      let alternativeBatch: InventoryItem | null = null;
      let status: 'Available' | 'Low Stock' | 'Out of Stock' = 'Out of Stock';

      if (exactBatches.length > 0 && exactBatches[0].currentQuantity >= item.qty) {
        status = 'Available';
      } else if (exactBatches.length > 0) {
        status = 'Low Stock';
      }

      // 2. If out of stock or low stock, check for generic equivalents in master list
      if (status !== 'Available' && exactMed) {
        const matchingGenerics = medicines.filter(m => m.id !== exactMed.id && m.category === exactMed.category);
        
        for (let genMed of matchingGenerics) {
          const genBatches = inventory.filter(b => b.medicineId === genMed.id && b.currentQuantity >= item.qty && b.status !== 'Expired');
          if (genBatches.length > 0) {
            alternativeMed = genMed;
            alternativeBatch = genBatches[0];
            break;
          }
        }
      }

      return {
        prescribedName: item.name,
        prescribedQty: item.qty,
        strength: item.strength,
        matchedMed: exactMed,
        matchedBatch: exactBatches[0] || null,
        status,
        alternativeMed,
        alternativeBatch
      };
    });

  }, [selectedPrx, medicines, inventory]);

  // Handle uploading simulation
  const handleUploadClick = () => {
    setIsUploading(true);
    setDispenseSuccess(false);
    setTimeout(() => {
      setIsUploading(false);
      // Auto-load Karan Johar's simulated prescription
      setSelectedPrxId("SIM-PRX-102");
    }, 1200);
  };

  // Dispense entire prescription list to cart
  const handleDispense = () => {
    if (!selectedPrx) return;

    // Filter out matched batches or alternative batches
    const itemsToCart: Array<{ medicine: MedicineMaster; batch: InventoryItem; quantity: number }> = [];

    matchedDispenseList.forEach(item => {
      if (item.status === 'Available' && item.matchedMed && item.matchedBatch) {
        itemsToCart.push({
          medicine: item.matchedMed,
          batch: item.matchedBatch,
          quantity: item.prescribedQty
        });
      } else if (item.alternativeMed && item.alternativeBatch) {
        itemsToCart.push({
          medicine: item.alternativeMed,
          batch: item.alternativeBatch,
          quantity: item.prescribedQty
        });
      }
    });

    if (itemsToCart.length === 0) {
      alert("No available medications are in stock to dispense. Please check generic alternatives.");
      return;
    }

    onDispensePrescription(selectedPrx.id, itemsToCart);
    setDispenseSuccess(true);
    
    // Auto navigate to sales tab after brief delay
    setTimeout(() => {
      onNavigateToTab('sales');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Clinical Verification
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Prescription Verification Desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Digitally verify doctor prescriptions, run automated therapeutic checks, and suggest generic substitutions instantly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: List & Upload Area (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* File Uploader box */}
          <div 
            onClick={handleUploadClick}
            className={`cursor-pointer group border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-white hover:bg-slate-50/50 ${isUploading ? 'border-teal-500 bg-teal-50/30' : 'border-slate-200 hover:border-teal-400'}`}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-teal-50 group-hover:text-teal-600 transition-all">
                <Upload className="h-6 w-6 text-slate-400 group-hover:text-teal-500" />
              </div>
              <h4 className="font-display text-sm font-bold text-slate-800 mt-3.5">
                {isUploading ? 'Analyzing Document structure...' : 'Upload Prescription Image / PDF'}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                Drag & drop scan or click to simulate importing. Supports JPEG, PNG, PDF up to 8MB.
              </p>
            </div>
          </div>

          {/* Quick Simulated Prescription Presets */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Simulated Prescription Presets</h4>
            <div className="space-y-2">
              {PRESET_UPLOADS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => { setSelectedPrxId(preset.id); setDispenseSuccess(false); }}
                  className={`w-full text-left p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${selectedPrxId === preset.id ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{preset.patientName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{preset.description}</p>
                  </div>
                  <FileText className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          {/* Pending System Prescriptions list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Awaiting Verification Queue</h4>
            <div className="space-y-2">
              {prescriptions.map((prx) => (
                <button
                  key={prx.id}
                  onClick={() => { setSelectedPrxId(prx.id); setDispenseSuccess(false); }}
                  className={`w-full text-left p-3 rounded-xl border text-xs flex justify-between items-center transition-all ${selectedPrxId === prx.id ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{prx.patientName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">Dr: {prx.doctorName} | Date: {prx.date}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 font-mono ml-2 ${prx.status === 'Dispensed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {prx.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Interactive Audit Desk (7 Cols) */}
        <div className="lg:col-span-7">
          {selectedPrx ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              
              {/* Doctor Patient Profile card */}
              <div className="flex justify-between items-start border-b border-slate-50 pb-4">
                <div>
                  <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                    Active Verification Sheet
                  </span>
                  <h3 className="font-display text-base font-bold text-slate-900 mt-1.5">
                    Patient: {selectedPrx.patientName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">Contact: {selectedPrx.patientContact}</p>
                </div>

                <div className="text-right text-xs text-slate-500 font-mono">
                  <p className="font-bold text-slate-700">Prescriber: {selectedPrx.doctorName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Dated: {selectedPrx.date}</p>
                </div>
              </div>

              {/* Dynamic matching workspace */}
              <div className="space-y-4">
                <h4 className="font-display text-sm font-bold text-slate-800">
                  Formulary Verification & Stock Match
                </h4>

                <div className="space-y-3">
                  {matchedDispenseList.map((item, idx) => {
                    return (
                      <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-start text-xs">
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{item.prescribedName}</span>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                              Prescribed strength: {item.strength || 'Standard'} | Required Qty: {item.prescribedQty}
                            </span>
                          </div>

                          {/* Matching status */}
                          {item.status === 'Available' ? (
                            <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              Stock Available
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold font-mono text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                              Shortage Match
                            </span>
                          )}
                        </div>

                        {/* If matched available, show details */}
                        {item.status === 'Available' && item.matchedBatch && (
                          <div className="bg-white p-3 rounded-lg border border-slate-100 text-xs flex justify-between font-mono">
                            <span className="text-slate-500">Inventory: Batch {item.matchedBatch.batchNumber} (Shelf: {item.matchedBatch.warehouseLocation})</span>
                            <span className="font-bold text-slate-700">Available: {item.matchedBatch.currentQuantity} units</span>
                          </div>
                        )}

                        {/* If matching is out of stock, propose Generic alternatives */}
                        {item.status !== 'Available' && (
                          <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl space-y-2">
                            <div className="flex items-center gap-1.5 text-indigo-950 font-semibold text-xs">
                              <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500 animate-spin-slow" />
                              Generic Equivalents Recommended
                            </div>
                            
                            {item.alternativeMed && item.alternativeBatch ? (
                              <div className="bg-white p-3 rounded-lg border border-indigo-100 flex justify-between items-center text-xs">
                                <div>
                                  <span className="font-bold text-slate-800 block">{item.alternativeMed.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                    Generic: {item.alternativeMed.genericName} (Batch: {item.alternativeBatch.batchNumber})
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded text-[10px]">
                                  Substitute Available ({item.alternativeBatch.currentQuantity} units)
                                </span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No alternative brand found in master inventory with matching pharmacological properties.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action dispensaries */}
              {selectedPrx.status === 'Dispensed' ? (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <p className="font-semibold">This prescription has already been dispensed and logged in the billing register.</p>
                </div>
              ) : dispenseSuccess ? (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800 animate-bounce">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <p className="font-semibold">Dispensing order triggered! Transferring variables to Active Billing Cart...</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDispense}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 font-semibold text-xs text-white rounded-xl shadow-xs cursor-pointer tracking-wider uppercase flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-4.5 w-4.5" />
                  Approve & Dispense Prescription (Transfer to POS)
                </button>
              )}

            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center text-slate-400 h-full min-h-[400px]">
              <FileText className="h-12 w-12 text-slate-200 mb-2" />
              <p className="text-sm font-semibold">Select a Prescription</p>
              <p className="text-xs max-w-xs mt-1">Upload a scanned file or choose a preset card from the list to cross-check available stock levels and fill the order.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
