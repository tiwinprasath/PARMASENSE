/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { MedicineMaster, InventoryItem, Sale, Supplier, Customer } from '../types';
import { 
  FileText, Download, Eye, Table, CheckSquare, 
  TrendingUp, Truck, AlertTriangle, Users, FileSpreadsheet, ArrowUpRight
} from 'lucide-react';

interface ReportsViewProps {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  sales: Sale[];
  suppliers: Supplier[];
  customers: Customer[];
}

export default function ReportsView({
  medicines,
  inventory,
  sales,
  suppliers,
  customers
}: ReportsViewProps) {
  const [selectedReportType, setSelectedReportType] = useState<'inventory' | 'sales' | 'expiry' | 'suppliers' | 'lowstock'>('inventory');

  // Preview data based on selected report
  const previewData = useMemo(() => {
    switch (selectedReportType) {
      case 'inventory':
        return inventory.map(item => {
          const med = medicines.find(m => m.id === item.medicineId);
          return {
            'Medicine Name': med?.name || 'Unknown',
            'Generic Formula': med?.genericName || 'Unknown',
            'Batch No': item.batchNumber,
            'Current Qty': item.currentQuantity,
            'Unit Price (₹)': item.sellingPrice,
            'Holding Value (₹)': item.currentQuantity * item.purchasePrice,
            'Shelf Location': item.warehouseLocation,
            'Status': item.status
          };
        });

      case 'sales':
        return sales.map(s => {
          const med = medicines.find(m => m.id === s.medicineId);
          return {
            'Invoice ID': s.id,
            'Date': s.date,
            'Customer': s.customerName,
            'Medicine': med?.name || 'Unknown',
            'Quantity': s.quantity,
            'Price Paid (₹)': s.totalAmount,
            'Payment Method': s.paymentMethod
          };
        });

      case 'expiry':
        // Expiry list
        return inventory
          .filter(item => {
            const currentDate = new Date('2026-07-07');
            const expDate = new Date(item.expiryDate);
            return expDate.getTime() <= currentDate.getTime() || (expDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24) <= 90;
          })
          .map(item => {
            const med = medicines.find(m => m.id === item.medicineId);
            const currentDate = new Date('2026-07-07');
            const expDate = new Date(item.expiryDate);
            const diffDays = Math.ceil((expDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return {
              'Medicine Name': med?.name || 'Unknown',
              'Batch Number': item.batchNumber,
              'Expiry Date': item.expiryDate,
              'Days Left': diffDays <= 0 ? 'Expired' : `${diffDays} days`,
              'Stock Quantity': item.currentQuantity,
              'Holding Valuation (₹)': item.currentQuantity * item.purchasePrice,
              'Warehouse Location': item.warehouseLocation
            };
          });

      case 'suppliers':
        return suppliers.map(s => ({
          'Supplier ID': s.id,
          'Company Name': s.companyName,
          'Representative': s.contactPerson,
          'Phone': s.contactNumber,
          'Availability Rating': `${s.productAvailabilityPercent}%`,
          'Delivery Speed': `${s.deliveryTimeDays} days`,
          'Fulfillment Score': s.rating
        }));

      case 'lowstock':
        return inventory
          .filter(item => item.currentQuantity <= item.reorderLevel && item.status !== 'Expired')
          .map(item => {
            const med = medicines.find(m => m.id === item.medicineId);
            const supp = suppliers.find(s => s.id === item.supplierId);
            return {
              'Medicine Name': med?.name || 'Unknown',
              'Current Stock': item.currentQuantity,
              'Reorder Level': item.reorderLevel,
              'Required Inward': item.maximumStock - item.currentQuantity,
              'Preferred Supplier': supp?.companyName || 'Not Assigned',
              'Warehouse Location': item.warehouseLocation
            };
          });

      default:
        return [];
    }
  }, [selectedReportType, medicines, inventory, sales, suppliers]);

  // Download logic converting JSON object into CSV file
  const handleDownloadCSV = () => {
    if (previewData.length === 0) return;

    const headers = Object.keys(previewData[0]);
    const csvRows = [headers.join(',')];

    for (const row of previewData) {
      const values = headers.map(header => {
        const val = (row as any)[header];
        // Handle strings with commas or formatting
        const stringVal = val === null || val === undefined ? '' : String(val);
        const escaped = stringVal.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedReportType}_report_2026-07-07.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
            Business Intelligence
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 mt-1.5">
            Reports & Spreadsheet Exports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate and export spreadsheet audits of pharmacy stock assets, transaction journals, and supplier scorecards.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Choose Report (1 Col) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-fit space-y-2">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Select Report Subject</h4>
          
          <button
            onClick={() => setSelectedReportType('inventory')}
            className={`w-full text-left p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${selectedReportType === 'inventory' ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
          >
            <Table className="h-4.5 w-4.5 text-teal-600" />
            Inventory Value Report
          </button>

          <button
            onClick={() => setSelectedReportType('sales')}
            className={`w-full text-left p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${selectedReportType === 'sales' ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
          >
            <TrendingUp className="h-4.5 w-4.5 text-indigo-600" />
            Sales Invoices Journal
          </button>

          <button
            onClick={() => setSelectedReportType('expiry')}
            className={`w-full text-left p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${selectedReportType === 'expiry' ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
          >
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600" />
            Expiry Monitoring Sheet
          </button>

          <button
            onClick={() => setSelectedReportType('suppliers')}
            className={`w-full text-left p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${selectedReportType === 'suppliers' ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
          >
            <Truck className="h-4.5 w-4.5 text-amber-600" />
            Supplier Scorecard
          </button>

          <button
            onClick={() => setSelectedReportType('lowstock')}
            className={`w-full text-left p-3 rounded-xl border text-xs flex items-center gap-3 transition-all ${selectedReportType === 'lowstock' ? 'bg-teal-50 border-teal-200 text-teal-950 font-semibold' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
          >
            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
            Shortage & Reorders
          </button>
        </div>

        {/* Right Column: Preview & Download (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-800 uppercase">
                {selectedReportType} Audit Preview
              </h3>
              <p className="text-xs text-slate-400">Generated dynamic data log matching simulated date 2026-07-07</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-xs text-slate-600 rounded-xl flex items-center gap-1.5"
              >
                <Eye className="h-4 w-4" />
                Print / Save PDF
              </button>
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 font-semibold text-xs text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Export CSV / Excel
              </button>
            </div>
          </div>

          {/* Table Preview container */}
          {previewData.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-12">No data available for this report type.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 font-mono">
                    {Object.keys(previewData[0]).map((header, i) => (
                      <th key={i} className="px-4 py-3.5">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11px] font-mono text-slate-600">
                  {previewData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      {Object.values(row).map((val, idx) => (
                        <td key={idx} className="px-4 py-3 truncate max-w-[200px]">
                          {typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
