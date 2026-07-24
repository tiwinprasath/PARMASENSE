/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Sale, MedicineMaster } from '../types';
import { 
  Search, User, Phone, Mail, ShoppingBag, Calendar, FileText, Plus,
  ChevronRight, ArrowUpRight, Award, PlusCircle, CheckCircle2
} from 'lucide-react';

interface CustomerViewProps {
  customers: Customer[];
  sales: Sale[];
  medicines: MedicineMaster[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'purchaseHistoryIds' | 'prescriptionHistory'>) => void;
}

export default function CustomerView({
  customers,
  sales,
  medicines,
  onAddCustomer
}: CustomerViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Customer State
  const [newCust, setNewCust] = useState({
    name: '',
    contactNumber: '',
    email: ''
  });

  // Filter customers list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactNumber.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [customers, searchTerm]);

  // Find currently selected customer details
  const selectedCustomerDetails = useMemo(() => {
    if (!selectedCustomerId) return null;
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return null;

    // Fetch matching sales invoices
    const billingHistory = sales.filter(s => s.customerId === customer.id || s.customerName === customer.name);

    // Calculate frequent medication purchases
    const medCounts: { [key: string]: number } = {};
    billingHistory.forEach(s => {
      const med = medicines.find(m => m.id === s.medicineId);
      if (med) {
        medCounts[med.name] = (medCounts[med.name] || 0) + s.quantity;
      }
    });

    const frequentMeds = Object.entries(medCounts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    return {
      customer,
      billingHistory,
      frequentMeds
    };
  }, [selectedCustomerId, customers, sales, medicines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCustomer(newCust);
    setShowAddModal(false);
    setNewCust({ name: '', contactNumber: '', email: '' });
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Patient Care Hub
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Customer Profiles & Billing History
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain central patient records, track medicine purchase histories, inspect prescription logs, and generate loyalty details.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer transition-all"
        >
          <Plus className="h-4.5 w-4.5" />
          Onboard New Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customers Directory List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient name, contact number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden max-h-[500px] overflow-y-auto">
            <div className="divide-y divide-slate-50">
              {filteredCustomers.map((cust) => {
                const isSelected = selectedCustomerId === cust.id;
                return (
                  <button
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`w-full text-left p-4.5 flex justify-between items-center transition-all ${isSelected ? 'bg-teal-50/50 border-l-4 border-teal-600' : 'hover:bg-slate-50'}`}
                  >
                    <div>
                      <h4 className="font-display text-sm font-bold text-slate-800">{cust.name}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> {cust.contactNumber}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-slate-400 transition-all ${isSelected ? 'translate-x-1' : ''}`} />
                  </button>
                );
              })}

              {filteredCustomers.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No registered customers found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Patient Profile (7 Cols) */}
        <div className="lg:col-span-7">
          {selectedCustomerDetails ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-5">
                <div className="flex gap-4 items-center">
                  <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-display font-extrabold text-lg">
                    {selectedCustomerDetails.customer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">{selectedCustomerDetails.customer.name}</h3>
                    <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">{selectedCustomerDetails.customer.id}</p>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500 font-mono">
                  <p className="flex items-center gap-1.5 justify-end">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {selectedCustomerDetails.customer.contactNumber}
                  </p>
                  {selectedCustomerDetails.customer.email && (
                    <p className="flex items-center gap-1.5 justify-end mt-1 text-[11px]">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {selectedCustomerDetails.customer.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats & Loyalty */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/60 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pharmacy Purchases</span>
                  <span className="font-mono text-xl font-bold text-slate-800 block mt-1.5">
                    {selectedCustomerDetails.billingHistory.length} orders
                  </span>
                </div>
                <div className="bg-teal-50/55 p-4 rounded-xl border border-teal-100/60 text-center">
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">Frequent Medication</span>
                  <span className="font-display text-xs font-bold text-teal-950 block truncate mt-2.5">
                    {selectedCustomerDetails.frequentMeds[0]?.name || 'No items purchased yet'}
                  </span>
                </div>
              </div>

              {/* Purchase History */}
              <div className="space-y-3.5">
                <h4 className="font-display text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="h-4.5 w-4.5 text-teal-600" />
                  Chronological Purchase Invoices
                </h4>

                <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto pr-1">
                  {selectedCustomerDetails.billingHistory.map((bill, i) => {
                    const med = medicines.find(m => m.id === bill.medicineId);
                    return (
                      <div key={i} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-semibold text-slate-800">{med?.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                            Bill: {bill.id} | Date: {bill.date} (Batch {bill.batchNumber})
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-700 block">₹{bill.totalAmount.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400">Qty: {bill.quantity}</span>
                        </div>
                      </div>
                    );
                  })}

                  {selectedCustomerDetails.billingHistory.length === 0 && (
                    <p className="text-xs text-slate-400 py-6 text-center">This patient has no registered sales invoices.</p>
                  )}
                </div>
              </div>

              {/* Prescription history */}
              <div className="space-y-3 pt-2">
                <h4 className="font-display text-sm font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-teal-600" />
                  Historical Prescription Records
                </h4>

                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {selectedCustomerDetails.customer.prescriptionHistory.map((prx, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-slate-800">{prx.doctorName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Date: {prx.date}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {prx.medicines.map((m, idx) => (
                            <span key={idx} className="bg-teal-50 text-teal-700 font-medium px-2 py-0.5 rounded text-[10px] border border-teal-100/50">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedCustomerDetails.customer.prescriptionHistory.length === 0 && (
                    <p className="text-xs text-slate-400 py-4 text-center">No prescription history recorded.</p>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center text-slate-400 h-full min-h-[400px]">
              <User className="h-12 w-12 text-slate-200 mb-2" />
              <p className="text-sm font-semibold">Select a Patient</p>
              <p className="text-xs max-w-xs mt-1">Choose an onboarded patient from the directory to review their purchase trends, histories, and logs.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-teal-50 px-6 py-4 border-b border-teal-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-teal-950 text-base">Onboard Patient</h3>
              <button onClick={() => setShowAddModal(false)} className="text-teal-900 hover:text-teal-950 text-xs font-bold font-mono">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Full Patient Name*</label>
                <input
                  type="text" required
                  placeholder="e.g. Ramesh Chandra"
                  value={newCust.name}
                  onChange={(e) => setNewCust({...newCust, name: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Contact Phone*</label>
                <input
                  type="text" required
                  placeholder="e.g. +91 98765 00000"
                  value={newCust.contactNumber}
                  onChange={(e) => setNewCust({...newCust, contactNumber: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. patient@gmail.com"
                  value={newCust.email}
                  onChange={(e) => setNewCust({...newCust, email: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
                >
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
