/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MedicineMaster, InventoryItem, Sale, Customer } from '../types';
import { 
  Search, ShoppingCart, Tag, CreditCard, DollarSign, Sparkles, 
  Trash2, Receipt, CheckCircle, AlertTriangle, ArrowRight, UserPlus, Barcode
} from 'lucide-react';
import BarcodeQRScanner from './BarcodeQRScanner';

interface SalesViewProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  sales: Sale[];
  customers: Customer[];
  onRecordSale: (saleData: Omit<Sale, 'id' | 'totalAmount'>) => void;
  onNavigateToTab: (tab: string) => void;
  currentSystemDate: string;
}

export default function SalesView({
  medicines,
  inventory,
  sales,
  customers,
  onRecordSale,
  onNavigateToTab,
  currentSystemDate
}: SalesViewProps) {
  // Tabs: POS terminal or historic billing logs
  const [activeSubTab, setActiveSubTab] = useState<'terminal' | 'history'>('terminal');

  // Search filter for history log
  const [historySearch, setHistorySearch] = useState('');

  // active POS Cart drafting
  const [cartItems, setCartItems] = useState<Array<{
    medicine: MedicineMaster;
    batch: InventoryItem;
    quantity: number;
    discountPercent: number; // custom discount %
  }>>([]);

  // POS drafting states
  const [selectedMedId, setSelectedMedId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [walkInName, setWalkInName] = useState('Walk-In Customer');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Net Banking'>('UPI');
  const [showScannerModal, setShowScannerModal] = useState(false);

  const handleScanMatch = (result: any) => {
    const matched = medicines.find(
      m => m.barcode === result.barcode || 
           m.name.toLowerCase() === result.name.toLowerCase() ||
           m.genericName.toLowerCase() === result.genericName.toLowerCase()
    );

    if (matched) {
      handleMedSelect(matched.id);
    }
    setShowScannerModal(false);
  };

  // Completed receipt view state
  const [latestReceipt, setLatestReceipt] = useState<{
    id: string;
    customer: string;
    date: string;
    items: Array<{
      name: string;
      batch: string;
      qty: number;
      price: number;
      discount: number;
      total: number;
    }>;
    totalBill: number;
  } | null>(null);

  // Filter batches based on chosen medicine
  const availableBatchesForSelectedMed = useMemo(() => {
    if (!selectedMedId) return [];
    return inventory.filter(b => b.medicineId === selectedMedId && b.currentQuantity > 0);
  }, [selectedMedId, inventory]);

  // Handle setting medicine -> auto-select first batch if available
  const handleMedSelect = (medId: string) => {
    setSelectedMedId(medId);
    const batches = inventory.filter(b => b.medicineId === medId && b.currentQuantity > 0);
    if (batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    } else {
      setSelectedBatchId('');
    }
  };

  // Warning checking for the active batch draft selection (Expiry Check)
  const isSelectedBatchExpired = useMemo(() => {
    if (!selectedBatchId) return false;
    const batch = inventory.find(b => b.id === selectedBatchId);
    if (!batch) return false;

    const currentDate = new Date(currentSystemDate);
    const expDate = new Date(batch.expiryDate);
    return expDate.getTime() <= currentDate.getTime();
  }, [selectedBatchId, inventory, currentSystemDate]);

  // Active stock availability of the selected batch
  const selectedBatchAvailableQty = useMemo(() => {
    if (!selectedBatchId) return 0;
    const batch = inventory.find(b => b.id === selectedBatchId);
    return batch ? batch.currentQuantity : 0;
  }, [selectedBatchId, inventory]);

  // Add Item to Cart
  const handleAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedId || !selectedBatchId) return;

    const medicine = medicines.find(m => m.id === selectedMedId);
    const batch = inventory.find(b => b.id === selectedBatchId);

    if (!medicine || !batch) return;

    // Strict safety check: BLOCK EXPIRED ITEMS
    const currentDate = new Date('2026-07-07');
    const expDate = new Date(batch.expiryDate);
    if (expDate.getTime() <= currentDate.getTime()) {
      alert("CRITICAL REJECTION: This batch has expired! The pharmacy dispensing protocol strictly prohibits selling expired medicines.");
      return;
    }

    if (orderQuantity > batch.currentQuantity) {
      alert(`SHORTAGE LIMIT: Only ${batch.currentQuantity} units available in batch ${batch.batchNumber}.`);
      return;
    }

    // Check if item already exists in cart, update it
    const existingIndex = cartItems.findIndex(item => item.batch.id === batch.id);
    if (existingIndex > -1) {
      const updatedCart = [...cartItems];
      const newQty = updatedCart[existingIndex].quantity + orderQuantity;
      if (newQty > batch.currentQuantity) {
        alert(`SHORTAGE LIMIT: Cannot exceed batch quantity of ${batch.currentQuantity}.`);
        return;
      }
      updatedCart[existingIndex].quantity = newQty;
      setCartItems(updatedCart);
    } else {
      setCartItems([...cartItems, {
        medicine,
        batch,
        quantity: orderQuantity,
        discountPercent: orderDiscount
      }]);
    }

    // Reset draft fields
    setOrderQuantity(1);
    setOrderDiscount(0);
  };

  // Calculate Running Totals for Cart
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let gstAmount = 0;
    let discountAmount = 0;

    cartItems.forEach(item => {
      const lineCost = item.quantity * item.batch.sellingPrice;
      const discount = lineCost * (item.discountPercent / 100);
      const afterDiscount = lineCost - discount;
      
      // gst is included in price, or calculated on top. Let's assume inclusive of GST
      const gstRate = item.medicine.gst;
      const gstVal = afterDiscount * (gstRate / (100 + gstRate));

      subtotal += lineCost;
      discountAmount += discount;
      gstAmount += gstVal;
    });

    const total = subtotal - discountAmount;

    return {
      subtotal,
      discountAmount,
      gstAmount,
      total
    };
  }, [cartItems]);

  // Checkout and Submit Invoices
  const handleCheckout = () => {
    if (cartItems.length === 0) return;

    const customer = customers.find(c => c.id === selectedCustomerId);
    const finalCustName = customer ? customer.name : walkInName;
    const dateStr = currentSystemDate; // current simulated audit date
    const invoiceId = "BIL-" + Math.floor(100000 + Math.random() * 900000);

    // Record each item in cart to sales history & decrease inventory stock
    cartItems.forEach(item => {
      onRecordSale({
        medicineId: item.medicine.id,
        batchNumber: item.batch.batchNumber,
        customerName: finalCustName,
        customerId: selectedCustomerId || undefined,
        date: dateStr,
        quantity: item.quantity,
        price: item.batch.sellingPrice,
        discount: item.discountPercent,
        gst: item.medicine.gst,
        paymentMethod: paymentMethod
      });
    });

    // Save temporary latest receipt for display/print
    setLatestReceipt({
      id: invoiceId,
      customer: finalCustName,
      date: dateStr,
      items: cartItems.map(item => {
        const lineTotal = item.quantity * item.batch.sellingPrice * (1 - item.discountPercent / 100);
        return {
          name: item.medicine.name,
          batch: item.batch.batchNumber,
          qty: item.quantity,
          price: item.batch.sellingPrice,
          discount: item.discountPercent,
          total: lineTotal
        };
      }),
      totalBill: cartTotals.total
    });

    // Flush active cart state
    setCartItems([]);
    setSelectedCustomerId('');
    setWalkInName('Walk-In Customer');
  };

  // MODULE 7: Combo purchase associations
  // Suggest combos based on cart items (e.g., if Paracetamol in cart, suggest Cough Syrup)
  const comboSuggestions = useMemo(() => {
    const hasParacetamol = cartItems.some(i => i.medicine.id === 'MED-001');
    const hasCoughSyrup = cartItems.some(i => i.medicine.id === 'MED-006');
    const hasAmoxicillin = cartItems.some(i => i.medicine.id === 'MED-002');

    const list = [];
    if (hasParacetamol && !hasCoughSyrup) {
      list.push({
        targetId: 'MED-006',
        reason: 'Frequently purchased together with Paracetamol (Monsoon fever standard pattern).',
        title: 'Cough Syrup D',
        badge: 'Seasonal Combo Offer'
      });
    }
    if (hasAmoxicillin && !hasParacetamol) {
      list.push({
        targetId: 'MED-001',
        reason: 'Often prescribed together for bacterial airway ailments.',
        title: 'Paracetamol 650',
        badge: 'Standard Prescribed Pair'
      });
    }
    return list;
  }, [cartItems]);

  // Filtering through billing logs history
  const filteredSalesHistory = useMemo(() => {
    return sales.filter(s => {
      const med = medicines.find(m => m.id === s.medicineId);
      return (
        s.customerName.toLowerCase().includes(historySearch.toLowerCase()) ||
        med?.name.toLowerCase().includes(historySearch.toLowerCase()) ||
        s.id.toLowerCase().includes(historySearch.toLowerCase()) ||
        s.batchNumber.toLowerCase().includes(historySearch.toLowerCase())
      );
    }).slice(0, 50); // limit to last 50 transactions
  }, [sales, historySearch, medicines]);

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Invoicing & Demand
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Billing & Sales POS
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispense medications, automatically prevent expired sales, apply promotional pricing, and track seasonal demand patterns.
          </p>
        </div>

        {/* Sub-tab options */}
        <div className="flex overflow-x-auto max-w-full w-full sm:w-auto bg-slate-100 p-1 rounded-xl border border-slate-200/50 shrink-0">
          <button
            onClick={() => { setActiveSubTab('terminal'); setLatestReceipt(null); }}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${activeSubTab === 'terminal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Terminal POS
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all ${activeSubTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Sales History Logs
          </button>
        </div>
      </div>

      {/* TERMINAL TAB */}
      {activeSubTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Drafting Panel & Combo Alerts (8 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Draft Formulation form */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-teal-600" />
                  Select Medication & Batch
                </h3>
                <button
                  type="button"
                  onClick={() => setShowScannerModal(true)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-teal-400 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 text-xs font-bold shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5 text-teal-400 animate-pulse" />
                  AI Barcode/QR Scanner
                </button>
              </div>

              <form onSubmit={handleAddToCart} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Medicine Selector */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Medication Brand*</label>
                    <select
                      value={selectedMedId}
                      onChange={(e) => handleMedSelect(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white font-semibold text-slate-700"
                    >
                      <option value="">-- Choose Brand --</option>
                      {medicines.map((m) => {
                        const count = inventory.filter(i => i.medicineId === m.id).reduce((sum, b) => sum + b.currentQuantity, 0);
                        return (
                          <option key={m.id} value={m.id}>{m.name} [In Stock: {count} units]</option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Batch Selector */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Batch Number*</label>
                    <select
                      value={selectedBatchId}
                      onChange={(e) => setSelectedBatchId(e.target.value)}
                      disabled={!selectedMedId}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white font-mono text-slate-700"
                    >
                      <option value="">-- Select Active Batch --</option>
                      {availableBatchesForSelectedMed.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} (Exp: {b.expiryDate}) [Qty: {b.currentQuantity}] (₹{b.sellingPrice}/ea)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Expiry strict red block alert */}
                {isSelectedBatchExpired && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex gap-3 animate-pulse">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold">CRITICAL BLOCK: EXPIRED MEDICATION</p>
                      <p className="mt-0.5">The selected batch has passed its expiry threshold. This batch cannot be added to active sales. Return stock to supplier immediately.</p>
                    </div>
                  </div>
                )}

                {/* Draft details */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Dispense Qty</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedBatchAvailableQty}
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(Number(e.target.value))}
                      disabled={!selectedBatchId || isSelectedBatchExpired}
                      className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Promo Discount (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={orderDiscount}
                      onChange={(e) => setOrderDiscount(Number(e.target.value))}
                      disabled={!selectedBatchId || isSelectedBatchExpired}
                      className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-teal-600 font-semibold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={!selectedBatchId || isSelectedBatchExpired || orderQuantity <= 0}
                      className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed font-semibold text-xs text-white rounded-xl cursor-pointer transition-all h-[36px]"
                    >
                      Add To Cart
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* MODULE 7: Dynamic Combo associations Suggestions */}
            {comboSuggestions.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex gap-3.5">
                <Sparkles className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-display font-bold text-indigo-950 text-sm">Ais-Assist: Shelf Combo Recommendation</h4>
                  <p className="text-xs text-indigo-700 leading-relaxed mt-0.5">
                    Our sales logs indicate the current cart matches recurring purchase patterns:
                  </p>
                  <div className="space-y-2 mt-3">
                    {comboSuggestions.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs bg-white p-3 rounded-xl border border-indigo-100">
                        <div>
                          <span className="font-bold text-indigo-950 block">{item.title}</span>
                          <span className="text-[10px] text-slate-500 block">{item.reason}</span>
                        </div>
                        <button 
                          onClick={() => { handleMedSelect(item.targetId); }}
                          className="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1"
                        >
                          Fill Item <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Receipt Modal Display (if checkout completed) */}
            {latestReceipt && (
              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-display font-bold text-emerald-950 text-base">Checkout Successful! Receipt Generated</h3>
                </div>

                {/* Printable receipt mockup */}
                <div className="bg-white p-5 rounded-xl border border-emerald-100/60 font-mono text-xs space-y-3.5 shadow-xs max-w-[400px]">
                  <div className="text-center border-b border-dashed border-slate-200 pb-3">
                    <span className="font-bold font-display text-base text-slate-800">PREMIER PHARMACY LTD</span>
                    <p className="text-[10px] text-slate-400">GSTIN: 27AAAAA1111A1Z0 | Date: {latestReceipt.date}</p>
                    <p className="text-[10px] text-slate-400">Bill ID: {latestReceipt.id}</p>
                  </div>

                  <div>
                    <p className="font-bold text-slate-700">Patient: {latestReceipt.customer}</p>
                  </div>

                  <div className="border-b border-dashed border-slate-200 pb-3 space-y-1.5">
                    {latestReceipt.items.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{item.name} x {item.qty} (B: {item.batch})</span>
                        <span>₹{item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between font-bold text-sm text-slate-800">
                    <span>Total Amount Paid:</span>
                    <span>₹{latestReceipt.totalBill.toFixed(2)}</span>
                  </div>

                  <div className="text-center text-[9px] text-slate-400 border-t border-dashed border-slate-200 pt-3">
                    Thank you for choosing Premier Pharmacy. Stay Healthy!
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs text-white rounded-xl"
                  >
                    Print Bill (PDF Export)
                  </button>
                  <button
                    onClick={() => setLatestReceipt(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-xs text-slate-600 rounded-xl"
                  >
                    Dismiss Invoicing Receipt
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Active Invoicing Cart (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="border-b border-slate-50 pb-3.5 flex justify-between items-center">
                <h3 className="font-display text-base font-bold text-slate-800 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-teal-600" />
                  Active Invoicing Cart
                </h3>
                <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                  {cartItems.length} items
                </span>
              </div>

              {/* Patient/Customer Assignment */}
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Customer Assignment</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                  >
                    <option value="">-- Generic Walk-In Patient --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.contactNumber})</option>
                    ))}
                  </select>
                </div>

                {/* If generic, allow writing name */}
                {!selectedCustomerId && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Walk-In Patient Name</label>
                    <input
                      type="text"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-slate-400 text-center">
                  <ShoppingCart className="h-10 w-10 text-slate-200 mb-2" />
                  <p className="text-sm font-semibold">Your draft invoice is empty</p>
                  <p className="text-xs">Add prescription items from the left workspace panel.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                    {cartItems.map((item, index) => {
                      const finalItemCost = item.quantity * item.batch.sellingPrice * (1 - item.discountPercent / 100);
                      return (
                        <div key={index} className="flex justify-between items-start bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs">
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-slate-800 block truncate">{item.medicine.name}</span>
                            <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                              Batch {item.batch.batchNumber} x {item.quantity} (₹{item.batch.sellingPrice.toFixed(2)}/ea)
                            </span>
                            {item.discountPercent > 0 && (
                              <span className="inline-block bg-teal-50 text-teal-700 text-[9px] font-bold px-1.5 py-0.2 rounded mt-1 font-mono">
                                Discount Applied: -{item.discountPercent}%
                              </span>
                            )}
                          </div>

                          <div className="text-right font-mono shrink-0 ml-2">
                            <span className="font-bold text-slate-700 block">₹{finalItemCost.toFixed(2)}</span>
                            <button
                              onClick={() => setCartItems(cartItems.filter((_, i) => i !== index))}
                              className="text-slate-400 hover:text-rose-600 mt-2 font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Totals */}
                  <div className="border-t border-slate-100 pt-3 space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal:</span>
                      <span>₹{cartTotals.subtotal.toFixed(2)}</span>
                    </div>
                    {cartTotals.discountAmount > 0 && (
                      <div className="flex justify-between text-teal-600 font-semibold">
                        <span>Combo / Markdown Promo:</span>
                        <span>-₹{cartTotals.discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>GST (Included):</span>
                      <span>₹{cartTotals.gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-slate-800 border-t border-dashed border-slate-100 pt-2.5">
                      <span>Total Invoice:</span>
                      <span>₹{cartTotals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment selection & checkout */}
                  <div className="space-y-2.5 pt-3 border-t border-slate-50">
                    <label className="text-[10px] font-bold text-slate-400 block uppercase">Select Payment Channel</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['UPI', 'Cash', 'Card', 'Net Banking'].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method as any)}
                          className={`py-2 text-xs font-semibold border rounded-xl transition-all ${paymentMethod === method ? 'bg-teal-50 border-teal-500 text-teal-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleCheckout}
                      className="w-full py-3 bg-teal-600 hover:bg-teal-700 font-semibold text-xs text-white rounded-xl shadow-xs cursor-pointer tracking-wider uppercase mt-4 flex items-center justify-center gap-1.5"
                    >
                      <Receipt className="h-4.5 w-4.5" />
                      Dispense & Print Bill
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* HISTORY TAB */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, medicine, invoice number..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
              />
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400">
              Showing last 50 transactions
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">Invoice ID</th>
                    <th className="px-6 py-4">Dispense Date</th>
                    <th className="px-6 py-4">Patient Name</th>
                    <th className="px-6 py-4">Medicine & Batch</th>
                    <th className="px-6 py-4 text-right">Sold Qty</th>
                    <th className="px-6 py-4 text-right">Invoice total</th>
                    <th className="px-6 py-4 text-center">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {filteredSalesHistory.map((s) => {
                    const med = medicines.find(m => m.id === s.medicineId);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4 font-mono font-bold text-slate-700">{s.id}</td>
                        <td className="px-6 py-4 font-mono">{s.date}</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{s.customerName}</td>
                        <td className="px-6 py-4">
                          <span className="font-semibold block text-slate-800">{med?.name || 'Unknown'}</span>
                          <span className="font-mono text-[10px] text-slate-400">Batch {s.batchNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-semibold text-slate-700">{s.quantity} units</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 text-sm">
                          ₹{s.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block font-semibold bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded">
                            {s.paymentMethod}
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
