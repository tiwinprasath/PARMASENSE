/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MedicineMaster, InventoryItem, Sale, Supplier, Customer, Prescription, Notification, SchedulerLog } from '../types';

export const INITIAL_MEDICINES: MedicineMaster[] = [
  {
    id: 'MED-01',
    name: 'Paracetamol 650mg',
    genericName: 'Acetaminophen',
    brand: 'Calpol',
    manufacturer: 'GSK Pharma',
    category: 'Analgesic',
    strength: '650mg',
    unit: 'Tablet',
    mrp: 35.0,
    gst: 12,
    storageCondition: 'Store below 30°C',
    barcode: '8901101234567',
    description: 'Relief of mild to moderate pain and reduction of fever.'
  },
  {
    id: 'MED-02',
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin Trihydrate',
    brand: 'Novamox',
    manufacturer: 'Cipla Ltd',
    category: 'Antibiotic',
    strength: '500mg',
    unit: 'Capsule',
    mrp: 120.0,
    gst: 12,
    storageCondition: 'Store in a dry place',
    barcode: '8901101234574',
    description: 'Broad-spectrum penicillin antibiotic for bacterial infections.'
  },
  {
    id: 'MED-03',
    name: 'Atorvastatin 10mg',
    genericName: 'Atorvastatin Calcium',
    brand: 'Lipitor',
    manufacturer: 'Pfizer',
    category: 'Cardiopathic',
    strength: '10mg',
    unit: 'Tablet',
    mrp: 85.0,
    gst: 18,
    storageCondition: 'Store at 20-25°C',
    barcode: '8901101234581',
    description: 'HMG-CoA reductase inhibitor used to lower lipids and cholesterol.'
  },
  {
    id: 'MED-04',
    name: 'Metformin 500mg ER',
    genericName: 'Metformin Hydrochloride',
    brand: 'Glycomet',
    manufacturer: 'USV Biotech',
    category: 'Antidiabetic',
    strength: '500mg',
    unit: 'Tablet',
    mrp: 45.0,
    gst: 12,
    storageCondition: 'Store below 25°C',
    barcode: '8901101234598',
    description: 'Extended-release oral antihyperglycemic agent for Type 2 diabetes.'
  },
  {
    id: 'MED-05',
    name: 'Cetirizine 10mg',
    genericName: 'Cetirizine Dihydrochloride',
    brand: 'Alerid',
    manufacturer: 'Cipla Ltd',
    category: 'Antihistamine',
    strength: '10mg',
    unit: 'Tablet',
    mrp: 28.0,
    gst: 12,
    storageCondition: 'Store below 25°C',
    barcode: '8901101234604',
    description: 'Non-sedating antihistamine for allergic rhinitis and urticaria.'
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-01',
    companyName: 'MedLife Distributors Ltd.',
    contactPerson: 'Amit Sharma',
    contactNumber: '+91 98765 43210',
    email: 'orders@medlifedist.com',
    address: '42, Industrial Area Phase II, Okhla, New Delhi',
    deliveryTimeDays: 2,
    productAvailabilityPercent: 96,
    rating: 4.5,
    purchaseHistoryCount: 48
  },
  {
    id: 'SUP-02',
    companyName: 'Apex Pharma Care',
    contactPerson: 'Rajesh Nair',
    contactNumber: '+91 91234 56789',
    email: 'support@apexpharma.in',
    address: '105, Crystal Plaza, Andheri West, Mumbai',
    deliveryTimeDays: 3,
    productAvailabilityPercent: 91,
    rating: 4.1,
    purchaseHistoryCount: 32
  },
  {
    id: 'SUP-03',
    companyName: 'Sunrise Therapeutics Inc.',
    contactPerson: 'Sanjay Gupta',
    contactNumber: '+91 88888 77777',
    email: 'gupta@sunrisethera.com',
    address: 'Sector 5, Salt Lake, Kolkata',
    deliveryTimeDays: 4,
    productAvailabilityPercent: 98,
    rating: 4.8,
    purchaseHistoryCount: 15
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'INV-01',
    medicineId: 'MED-01',
    batchNumber: 'B-PM203',
    manufacturingDate: '2025-01-10',
    expiryDate: '2027-01-10', // Active
    purchaseDate: '2025-01-20',
    currentQuantity: 340,
    minimumStock: 50,
    maximumStock: 500,
    reorderLevel: 100,
    supplierId: 'SUP-01',
    purchasePrice: 15.0,
    sellingPrice: 35.0,
    warehouseLocation: 'Shelf A-12',
    status: 'In Stock'
  },
  {
    id: 'INV-02',
    medicineId: 'MED-02',
    batchNumber: 'B-AM505',
    manufacturingDate: '2024-05-15',
    expiryDate: '2026-05-15', // EXPIRED relative to 2026-07-07
    purchaseDate: '2024-06-01',
    currentQuantity: 45,
    minimumStock: 20,
    maximumStock: 200,
    reorderLevel: 40,
    supplierId: 'SUP-02',
    purchasePrice: 60.0,
    sellingPrice: 120.0,
    warehouseLocation: 'Shelf B-3',
    status: 'Expired'
  },
  {
    id: 'INV-03',
    medicineId: 'MED-03',
    batchNumber: 'B-AT109',
    manufacturingDate: '2024-07-01',
    expiryDate: '2026-07-01', // EXPIRED relative to 2026-07-07
    purchaseDate: '2024-07-15',
    currentQuantity: 110,
    minimumStock: 30,
    maximumStock: 250,
    reorderLevel: 50,
    supplierId: 'SUP-01',
    purchasePrice: 40.0,
    sellingPrice: 85.0,
    warehouseLocation: 'Shelf C-8',
    status: 'Expired'
  },
  {
    id: 'INV-04',
    medicineId: 'MED-04',
    batchNumber: 'B-MT044',
    manufacturingDate: '2025-03-01',
    expiryDate: '2027-03-01', // Active
    purchaseDate: '2025-03-15',
    currentQuantity: 650,
    minimumStock: 100,
    maximumStock: 1000,
    reorderLevel: 200,
    supplierId: 'SUP-03',
    purchasePrice: 20.0,
    sellingPrice: 45.0,
    warehouseLocation: 'Shelf D-1',
    status: 'In Stock'
  },
  {
    id: 'INV-05',
    medicineId: 'MED-05',
    batchNumber: 'B-CT102',
    manufacturingDate: '2024-06-25',
    expiryDate: '2026-06-25', // EXPIRED relative to 2026-07-07
    purchaseDate: '2024-07-05',
    currentQuantity: 95,
    minimumStock: 25,
    maximumStock: 300,
    reorderLevel: 60,
    supplierId: 'SUP-02',
    purchasePrice: 10.0,
    sellingPrice: 28.0,
    warehouseLocation: 'Shelf B-9',
    status: 'Expired'
  }
];

export const INITIAL_SALES: Sale[] = [
  // Today's Sales (2026-07-07)
  {
    id: 'BIL-880192',
    medicineId: 'MED-01',
    batchNumber: 'B-PM203',
    customerName: 'Anil Kumar',
    customerId: 'CUST-01',
    date: '2026-07-07',
    quantity: 15,
    price: 35.0,
    discount: 5,
    gst: 12,
    paymentMethod: 'UPI',
    totalAmount: 498.75
  },
  {
    id: 'BIL-880193',
    medicineId: 'MED-04',
    batchNumber: 'B-MT044',
    customerName: 'Suman Lata',
    customerId: 'CUST-02',
    date: '2026-07-07',
    quantity: 30,
    price: 45.0,
    discount: 0,
    gst: 12,
    paymentMethod: 'Cash',
    totalAmount: 1350.0
  },
  // Yesterday's Sales (2026-07-06)
  {
    id: 'BIL-880180',
    medicineId: 'MED-01',
    batchNumber: 'B-PM203',
    customerName: 'Rahul Verma',
    date: '2026-07-06',
    quantity: 20,
    price: 35.0,
    discount: 10,
    gst: 12,
    paymentMethod: 'Card',
    totalAmount: 630.0
  },
  {
    id: 'BIL-880181',
    medicineId: 'MED-04',
    batchNumber: 'B-MT044',
    customerName: 'Karan Mehra',
    date: '2026-07-06',
    quantity: 10,
    price: 45.0,
    discount: 0,
    gst: 12,
    paymentMethod: 'UPI',
    totalAmount: 450.0
  },
  // July 5th Sales (2026-07-05)
  {
    id: 'BIL-880170',
    medicineId: 'MED-01',
    batchNumber: 'B-PM203',
    customerName: 'Meena Saxena',
    date: '2026-07-05',
    quantity: 8,
    price: 35.0,
    discount: 0,
    gst: 12,
    paymentMethod: 'Cash',
    totalAmount: 280.0
  },
  {
    id: 'BIL-880171',
    medicineId: 'MED-04',
    batchNumber: 'B-MT044',
    customerName: 'Aarti Bajaj',
    date: '2026-07-05',
    quantity: 25,
    price: 45.0,
    discount: 5,
    gst: 12,
    paymentMethod: 'UPI',
    totalAmount: 1068.75
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-01',
    name: 'Anil Kumar',
    contactNumber: '+91 99999 11111',
    email: 'anil.kumar@gmail.com',
    purchaseHistoryIds: ['BIL-880192'],
    prescriptionHistory: [
      {
        date: '2026-06-15',
        doctorName: 'Dr. Vivek Malhotra',
        medicines: ['Paracetamol 650mg']
      }
    ]
  },
  {
    id: 'CUST-02',
    name: 'Suman Lata',
    contactNumber: '+91 99999 22222',
    email: 'suman.l@outlook.com',
    purchaseHistoryIds: ['BIL-880193'],
    prescriptionHistory: [
      {
        date: '2026-07-02',
        doctorName: 'Dr. Neeta Bansal',
        medicines: ['Metformin 500mg ER']
      }
    ]
  }
];

export const INITIAL_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'PRX-001',
    patientName: 'Anil Kumar',
    patientContact: '+91 99999 11111',
    doctorName: 'Dr. Vivek Malhotra',
    date: '2026-07-07',
    medicines: [
      { name: 'Paracetamol 650mg', strength: '650mg', qty: 15 }
    ],
    status: 'Dispensed'
  },
  {
    id: 'PRX-002',
    patientName: 'Vikram Singh',
    patientContact: '+91 90000 88888',
    doctorName: 'Dr. Arun Shourie',
    date: '2026-07-07',
    medicines: [
      { name: 'Metformin 500mg ER', strength: '500mg', qty: 20 },
      { name: 'Cetirizine 10mg', strength: '10mg', qty: 10 }
    ],
    status: 'Pending'
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'NOT-101',
    type: 'expired',
    title: 'Amoxicillin Batch Expired',
    message: 'Batch B-AM505 of Novamox (Amoxicillin 500mg) expired on 2026-05-15. Move to Quarantine Shelf B-3 immediately.',
    date: '2026-07-07',
    isRead: false,
    severity: 'error'
  },
  {
    id: 'NOT-102',
    type: 'expired',
    title: 'Atorvastatin Batch Expired',
    message: 'Batch B-AT109 of Lipitor (Atorvastatin 10mg) expired on 2026-07-01. Move to Quarantine Shelf C-8.',
    date: '2026-07-07',
    isRead: false,
    severity: 'error'
  },
  {
    id: 'NOT-103',
    type: 'expired',
    title: 'Cetirizine Batch Expired',
    message: 'Batch B-CT102 of Alerid (Cetirizine 10mg) expired on 2026-06-25. Move to Quarantine Shelf B-9.',
    date: '2026-07-07',
    isRead: false,
    severity: 'error'
  }
];

export const INITIAL_SCHEDULER_LOGS: SchedulerLog[] = [
  {
    id: 'SCH-001',
    timestamp: '2026-07-07 08:00:00',
    runDate: '2026-07-07',
    checkedMedicinesCount: 5,
    expiredFound: 3,
    nearExpiryFound: 0,
    lowStockFound: 0,
    status: 'Warning'
  }
];
