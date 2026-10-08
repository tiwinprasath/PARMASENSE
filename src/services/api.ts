/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Thin fetch wrapper around the backend REST API (see /server/index.js).
 * All requests go to same-origin `/api/*` paths, which Vite proxies to
 * the Express server in development (see vite.config.ts) and which
 * should be reverse-proxied to the same backend in production.
 */
import {
  MedicineMaster, InventoryItem, Sale, Supplier,
  Customer, Prescription, Notification, SchedulerLog
  , MedicineRequest, RefillRequest, MedicineReminder, SupportTicket, PatientFeedback, AuditLog
} from '../types';

export interface UserAccount {
  email: string;
  passwordHash: string;
  role: string;
  name: string;
  active?: boolean;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  employeeId?: string;
  photoUrl?: string;
}

export interface AppState {
  medicines: MedicineMaster[];
  inventory: InventoryItem[];
  sales: Sale[];
  suppliers: Supplier[];
  customers: Customer[];
  prescriptions: Prescription[];
  notifications: Notification[];
  schedulerLogs: SchedulerLog[];
  medicineRequests: MedicineRequest[];
  refillRequests: RefillRequest[];
  reminders: MedicineReminder[];
  supportTickets: SupportTicket[];
  feedback: PatientFeedback[];
  auditLogs: AuditLog[];
  users?: UserAccount[];
}

export interface BarcodeLookupResponse {
  success: boolean;
  matched: boolean;
  code: string;
  format: string;
  confidence: number;
  medicine: {
    id: string | number;
    name: string;
    manufacturer: string;
    composition: string;
    price: number;
    description: string;
    barcode: string;
    format: string;
  } | null;
  matches?: Array<{
    id: string | number;
    name: string;
    manufacturer: string;
    composition: string;
    price: number;
    description: string;
    barcode: string;
    format: string;
  }>;
  packageFields?: {
    batch: string;
    manufacturingDate: string;
    expiryDate: string;
  };
  qrData?: {
    isStructured: boolean;
    isUrl: boolean;
    displayValue: string;
  } | null;
  message?: string;
  error?: string;
}

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `Request to ${path} failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore JSON parse errors on error bodies
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// --- Whole-state helpers -------------------------------------------------
export function fetchState(): Promise<AppState> {
  return request<AppState>('/state');
}

export function resetState(): Promise<AppState> {
  return request<AppState>('/state/reset', { method: 'POST' });
}

export function seedState(): Promise<AppState> {
  return request<AppState>('/state/seed', { method: 'POST' });
}

// --- Per-collection persistence -------------------------------------------
// Each function replaces the entire collection server-side, mirroring the
// app's existing "save the whole slice whenever it changes" pattern.
export const api = {
  saveMedicines: (records: MedicineMaster[]) => request<MedicineMaster[]>('/medicines', { method: 'PUT', body: JSON.stringify(records) }),
  saveInventory: (records: InventoryItem[]) => request<InventoryItem[]>('/inventory', { method: 'PUT', body: JSON.stringify(records) }),
  saveSales: (records: Sale[]) => request<Sale[]>('/sales', { method: 'PUT', body: JSON.stringify(records) }),
  saveSuppliers: (records: Supplier[]) => request<Supplier[]>('/suppliers', { method: 'PUT', body: JSON.stringify(records) }),
  saveCustomers: (records: Customer[]) => request<Customer[]>('/customers', { method: 'PUT', body: JSON.stringify(records) }),
  savePrescriptions: (records: Prescription[]) => request<Prescription[]>('/prescriptions', { method: 'PUT', body: JSON.stringify(records) }),
  saveNotifications: (records: Notification[]) => request<Notification[]>('/notifications', { method: 'PUT', body: JSON.stringify(records) }),
  saveSchedulerLogs: (records: SchedulerLog[]) => request<SchedulerLog[]>('/schedulerLogs', { method: 'PUT', body: JSON.stringify(records) }),
  saveMedicineRequests: (records: MedicineRequest[]) => request<MedicineRequest[]>('/medicineRequests', { method: 'PUT', body: JSON.stringify(records) }),
  saveRefillRequests: (records: RefillRequest[]) => request<RefillRequest[]>('/refillRequests', { method: 'PUT', body: JSON.stringify(records) }),
  saveReminders: (records: MedicineReminder[]) => request<MedicineReminder[]>('/reminders', { method: 'PUT', body: JSON.stringify(records) }),
  saveSupportTickets: (records: SupportTicket[]) => request<SupportTicket[]>('/supportTickets', { method: 'PUT', body: JSON.stringify(records) }),
  saveFeedback: (records: PatientFeedback[]) => request<PatientFeedback[]>('/feedback', { method: 'PUT', body: JSON.stringify(records) }),
  saveAuditLogs: (records: AuditLog[]) => request<AuditLog[]>('/auditLogs', { method: 'PUT', body: JSON.stringify(records) }),
  fetchUsers: () => request<UserAccount[]>('/users'),
  saveUsers: (records: UserAccount[]) => request<UserAccount[]>('/users', { method: 'PUT', body: JSON.stringify(records) }),
  loginAuth: (credentials: { email: string; password: string }) => 
    request<{ success: boolean; user: UserAccount }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
  registerAuth: (data: { name: string; email: string; password: string; role: string; phone?: string; address?: string; dateOfBirth?: string; employeeId?: string }) =>
    request<{ success: boolean; message: string; user: UserAccount }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  chatWithAssistant: (payload: { question: string; role?: string; patientMode?: boolean }) =>
    request<{ answer: string; medicineFound: boolean; medicines?: any[] }>('/chat', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  searchMedicinesDataset: (query: string, limit = 10) =>
    request<any[]>(`/medicines/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  lookupBarcode: (payload: { code: string; format: string }) =>
    request<BarcodeLookupResponse>('/scanner/barcode', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  identifyMedicine: (payload: {
    text?: string;
    image?: string;
    photos?: string[];
    textBySource?: {
      front?: string;
      back?: string;
      side?: string;
      'strip-front'?: string;
      'strip-back'?: string;
    };
    ocrConfidence?: number;
    ocrEvidence?: Array<{
      source: string;
      text: string;
      confidence: number;
      variant?: string;
      orientation?: number;
      words?: Array<{ text: string; confidence: number; bbox?: any }>;
    }>;
    barcode?: string;
    existingMedicines?: any[];
  }) =>
    request<{
      identified: boolean;
      confidence: number;
      matchType: string;
      ocrConfidence?: number;
      askVerification: boolean;
      isAlreadyInFormulary: boolean;
      existingFormularyId: string | null;
      verificationWarnings?: string[];
      vlmUsed?: boolean;
      vlmFields?: string[];
      ocrMethod?: 'Tesseract OCR' | 'Tesseract + Gemini Vision';
      medicineFoundInDatabase?: boolean;
      requiresVerification?: boolean;
      candidates?: Array<{
        id: number | string;
        name: string;
        score: number;
        signals?: Record<string, number>;
        manufacturer?: string;
        composition?: string;
        strength?: string;
        type?: string;
        pack_size_label?: string;
        price?: number;
      }>;
      matchedMedicine: {
        id: number | string;
        name: string;
        manufacturer?: string;
        composition?: string;
        price?: number;
        type?: string;
        pack_size_label?: string;
        side_effects?: string;
        description?: string;
      } | null;
      extractedFields: {
        medicine_name: string;
        brand_name?: string;
        generic_name?: string;
        strength: string;
        dosage_form: string;
        manufacturer: string;
        composition: string;
        batch_no: string;
        manufacturing_date: string;
        expiry_date: string;
        pack_size?: string;
        mrp: number;
        barcode?: string;
        rx_required?: boolean;
        storage_instructions: string;
        warnings: string;
        field_evidence?: Record<string, {
          value: string | number;
          confidence: number;
          source: string;
          pass?: string;
        }>;
      };
      packageFields?: {
        batch_no: string;
        manufacturing_date: string;
        expiry_date: string;
        mrp: number;
        barcode?: string;
        storage_instructions: string;
        warnings: string;
      };
      catalogFields?: {
        name: string;
        composition: string;
        manufacturer: string;
        strength: string;
        dosage_form: string;
        price: number;
        pack_size_label?: string;
      };
    }>('/medicine/identify', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  extractMedicineFields: (payload: { text: string }) =>
    request<any>('/medicine/extract-fields', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
};

export default api;
