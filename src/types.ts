/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MedicineMaster {
  id: string; // Medicine ID
  name: string; // Medicine Name
  genericName: string; // Generic Name
  brand: string;
  manufacturer: string;
  category: string; // e.g., Antibiotic, Analgesic, Cardiopathic, etc.
  strength: string; // e.g., 500mg, 10mg
  unit: string; // e.g., Tablet, Capsule, Syrup, Injection
  mrp: number; // Maximum Retail Price
  gst: number; // GST percentage (e.g., 12, 18)
  storageCondition: string; // e.g., Store below 25°C, Refrigerate
  barcode: string;
  description: string;
}

export interface InventoryItem {
  id: string; // Inventory ID
  medicineId: string; // Reference to MedicineMaster
  batchNumber: string;
  manufacturingDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  purchaseDate: string; // YYYY-MM-DD
  currentQuantity: number;
  minimumStock: number;
  maximumStock: number;
  reorderLevel: number;
  supplierId: string; // Reference to Supplier
  purchasePrice: number;
  sellingPrice: number;
  warehouseLocation: string; // e.g., Shelf A4, Refrigerator B
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired';
}

export interface Sale {
  id: string; // Bill ID / Sale ID
  medicineId: string; // Reference to MedicineMaster
  batchNumber: string; // Batch sold from
  customerName: string; // Standard or Customer ID
  customerId?: string; // Reference to Customer (optional)
  date: string; // YYYY-MM-DD
  quantity: number;
  price: number; // Selling price per unit
  discount: number; // Discount percentage
  gst: number; // GST percentage
  paymentMethod: 'Cash' | 'Card' | 'UPI' | 'Net Banking';
  totalAmount: number;
}

export interface Supplier {
  id: string; // Supplier ID
  companyName: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
  deliveryTimeDays: number; // Average delivery time in days
  productAvailabilityPercent: number; // Availability score e.g. 95%
  rating: number; // Rating out of 5
  purchaseHistoryCount: number; // Number of orders placed with them
}

export interface Customer {
  id: string; // Customer ID
  name: string;
  contactNumber: string;
  email?: string;
  purchaseHistoryIds: string[]; // List of Sale IDs
  prescriptionHistory: Array<{
    date: string;
    doctorName: string;
    medicines: string[];
    prescriptionUrl?: string;
  }>;
}

export interface Prescription {
  id: string;
  patientName: string;
  patientContact: string;
  patientEmail?: string;
  doctorName: string;
  date: string;
  medicines: Array<{
    name: string; // Medicine name in prescription
    strength?: string;
    qty: number;
  }>;
  imageUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Dispensed' | 'Substituted';
}

export interface Notification {
  id: string;
  type: 'expiry' | 'low_stock' | 'expired' | 'restock' | 'supplier' | 'reminder' | 'prescription';
  title: string;
  message: string;
  date: string;
  isRead: boolean;
  severity: 'info' | 'warning' | 'error';
  patientEmail?: string;
  customerId?: string;
  medicineIds?: string[];
}

export type PatientRequestStatus = 'Pending' | 'Verified' | 'Preparing' | 'Ready for Pickup' | 'Completed' | 'Rejected';

export interface MedicineRequest {
  id: string;
  patientEmail: string;
  medicineId: string;
  quantity: number;
  status: PatientRequestStatus;
  createdAt: string;
}

export interface RefillRequest {
  id: string;
  patientEmail: string;
  medicineId: string;
  quantity: number;
  status: PatientRequestStatus;
  createdAt: string;
}

export interface MedicineReminder {
  id: string;
  patientEmail: string;
  medicineId: string;
  dosage: string;
  time: string;
  startDate: string;
  endDate: string;
  enabled: boolean;
}

export interface SupportTicket {
  id: string;
  patientEmail: string;
  subject: string;
  message: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  response?: string;
  createdAt: string;
}

export interface PatientFeedback {
  id: string;
  patientEmail: string;
  rating: number;
  comments: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userEmail: string;
  role: string;
  action: string;
  module: string;
  description: string;
  result: 'Success' | 'Warning' | 'Error';
  timestamp: string;
}

export interface SchedulerLog {
  id: string;
  timestamp: string;
  runDate: string;
  checkedMedicinesCount: number;
  expiredFound: number;
  nearExpiryFound: number;
  lowStockFound: number;
  status: 'Success' | 'Warning' | 'Error';
}

export interface ExternalTrendIndicator {
  id: string; // ID of the indicator log
  date: string; // YYYY-MM-DD
  googleTrendsScore: number; // 0 - 100 relative search interest for health/meds
  temperatureCelsius: number; // Simulated temp
  weatherCondition: 'Sunny' | 'Rainy' | 'Cold' | 'Humid' | 'Overcast';
  season: 'Winter' | 'Summer' | 'Monsoon' | 'Autumn' | 'Spring';
  isPublicHoliday: boolean;
  holidayName?: string;
  majorHealthTrend: string; // e.g., "Flu Spike", "Allergy Wave", "Standard Baseline"
}

export interface MedicinePrediction {
  id: string; // ID
  medicineId: string; // Reference to MedicineMaster
  predictedDemand7Days: number; // units predicted
  predictedDemand15Days: number; // units predicted
  predictedDemand30Days: number; // units predicted
  confidenceScore: number; // percentage e.g. 92.5
  reorderQuantityRecommended: number; // units to buy
  demandClassification: 'High Demand' | 'Stable' | 'Low Demand';
  lastUpdated: string; // YYYY-MM-DD
  trendFactor: number; // multiplier based on Google Trends + weather (e.g. 1.25)
  historicalMonthlyAverage: number; // units sold historically per month
}

