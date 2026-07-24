/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Supplier } from '../types';
import { 
  Search, Plus, Phone, Mail, MapPin, Truck, ShieldCheck, 
  Award, Star, Activity, ShoppingBag, PlusCircle
} from 'lucide-react';

interface SupplierViewProps {
  suppliers: Supplier[];
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'purchaseHistoryCount'>) => void;
}

export default function SupplierView({
  suppliers,
  onAddSupplier
}: SupplierViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Supplier Form State
  const [newSupp, setNewSupp] = useState({
    companyName: '',
    contactPerson: '',
    contactNumber: '',
    email: '',
    address: '',
    deliveryTimeDays: 3,
    productAvailabilityPercent: 95,
    rating: 4.5
  });

  // Filter suppliers based on search
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [suppliers, searchTerm]);

  // Rank suppliers based on a score: (Availability% * 0.4) + ((5 - DeliveryTime) * 10) + (Rating * 10)
  const rankedSuppliers = useMemo(() => {
    return [...suppliers]
      .map(s => {
        const availabilityScore = s.productAvailabilityPercent * 0.4;
        const speedScore = Math.max(0, (10 - s.deliveryTimeDays) * 6);
        const ratingScore = s.rating * 10;
        const totalScore = Math.round(availabilityScore + speedScore + ratingScore);
        
        return {
          ...s,
          totalScore
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [suppliers]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddSupplier(newSupp);
    setShowAddModal(false);
    // Reset form
    setNewSupp({
      companyName: '',
      contactPerson: '',
      contactNumber: '',
      email: '',
      address: '',
      deliveryTimeDays: 3,
      productAvailabilityPercent: 95,
      rating: 4.5
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Logistics & Procurement
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Supplier Relations Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain supplier contact directories, monitor lead delivery velocities, and view dynamic fulfillment reliability indexes.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer transition-all"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Supplier Partner
        </button>
      </div>

      {/* Supplier Performance and Ranking Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ranked Performance Column */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-1">
          <h3 className="font-display text-base font-bold text-slate-800 border-b border-slate-50 pb-3 mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Supplier Performance Ranking
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Ranked based on availability rates, average delivery speed (lead time), and fulfillment ratings.
          </p>

          <div className="space-y-3">
            {rankedSuppliers.map((supp, index) => {
              const placeColors = ["bg-amber-500 text-white", "bg-slate-300 text-slate-800", "bg-amber-700 text-white", "bg-slate-100 text-slate-500"];
              const placeColor = placeColors[Math.min(index, 3)];
              
              return (
                <div key={supp.id} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-100/60 hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-mono text-xs font-extrabold h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${placeColor}`}>
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 text-xs block truncate">{supp.companyName}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Score index: {supp.totalScore}/100</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end text-amber-500 text-xs font-bold gap-0.5">
                      <Star className="h-3 w-3 fill-amber-500" />
                      {supp.rating.toFixed(1)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Orders: {supp.purchaseHistoryCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Directory & Info Cards Grid (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search suppliers by name, representative, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSuppliers.map((supp) => (
              <div key={supp.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-md font-semibold">
                      {supp.id}
                    </span>
                    <span className="text-[11px] font-bold bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Active Partner
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-slate-800 mt-2.5">{supp.companyName}</h3>
                  <span className="text-xs text-slate-500 font-medium font-mono block">Rep: {supp.contactPerson}</span>

                  {/* Logistics metrics */}
                  <div className="grid grid-cols-2 gap-2 mt-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 block uppercase text-[9px]">Availability</span>
                      <span className="font-bold text-teal-600 block mt-0.5">{supp.productAvailabilityPercent}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase text-[9px]">Avg Lead Time</span>
                      <span className="font-bold text-slate-700 block mt-0.5">{supp.deliveryTimeDays} days</span>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1.5 mt-4 text-xs text-slate-500">
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{supp.contactNumber}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{supp.email}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{supp.address}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-mono">Fulfillment Rating:</span>
                  <div className="flex items-center text-amber-500 font-bold gap-0.5 font-mono">
                    <Star className="h-3.5 w-3.5 fill-amber-500" />
                    {supp.rating.toFixed(1)} / 5.0
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-teal-50 px-6 py-4 border-b border-teal-100 flex justify-between items-center">
              <h3 className="font-display font-bold text-teal-950 text-base">Onboard Supplier Partner</h3>
              <button onClick={() => setShowAddModal(false)} className="text-teal-900 hover:text-teal-950 text-xs font-bold font-mono">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Company / Distibutor Name*</label>
                <input
                  type="text" required
                  placeholder="e.g. Apex Biotech Wholesales"
                  value={newSupp.companyName}
                  onChange={(e) => setNewSupp({...newSupp, companyName: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Contact Person*</label>
                  <input
                    type="text" required
                    placeholder="Representative Name"
                    value={newSupp.contactPerson}
                    onChange={(e) => setNewSupp({...newSupp, contactPerson: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Contact Phone*</label>
                  <input
                    type="text" required
                    placeholder="e.g. +91 99999 11111"
                    value={newSupp.contactNumber}
                    onChange={(e) => setNewSupp({...newSupp, contactNumber: e.target.value})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Representative Email*</label>
                <input
                  type="email" required
                  placeholder="e.g. rep@distributor.com"
                  value={newSupp.email}
                  onChange={(e) => setNewSupp({...newSupp, email: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Office Address*</label>
                <input
                  type="text" required
                  placeholder="Distributor Headquarters Location"
                  value={newSupp.address}
                  onChange={(e) => setNewSupp({...newSupp, address: e.target.value})}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Avg Lead Time</label>
                  <input
                    type="number" required
                    value={newSupp.deliveryTimeDays}
                    onChange={(e) => setNewSupp({...newSupp, deliveryTimeDays: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Availability %</label>
                  <input
                    type="number" required
                    value={newSupp.productAvailabilityPercent}
                    onChange={(e) => setNewSupp({...newSupp, productAvailabilityPercent: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Fulfillment Rating</label>
                  <input
                    type="number" step="0.1" required
                    value={newSupp.rating}
                    onChange={(e) => setNewSupp({...newSupp, rating: Number(e.target.value)})}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
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
                  Confirm Supplier Partnership
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
