/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MedicineMaster, InventoryItem, Sale, Supplier, 
  Customer, Prescription, Notification, SchedulerLog, MedicineRequest, RefillRequest, MedicineReminder, SupportTicket, PatientFeedback, AuditLog
} from './types';
import { 
  INITIAL_MEDICINES, INITIAL_INVENTORY, INITIAL_SALES, 
  INITIAL_SUPPLIERS, INITIAL_CUSTOMERS, INITIAL_PRESCRIPTIONS, 
  INITIAL_NOTIFICATIONS, INITIAL_SCHEDULER_LOGS 
} from './data/seedData';
import { api, fetchState, UserAccount } from './services/api';

// Modular view panels
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import SalesView from './components/SalesView';
import SupplierView from './components/SupplierView';
import CustomerView from './components/CustomerView';
import PrescriptionView from './components/PrescriptionView';
import ReportsView from './components/ReportsView';
import SchedulerSimulator from './components/SchedulerSimulator';
import PharmacyAssistantView from './components/PharmacyAssistantView';
import ProfitView from './components/ProfitView';
import LoginView from './components/LoginView';
import LockScreen from './components/LockScreen';
import PredictionView from './components/PredictionView';
import PatientPortalView from './components/PatientPortalView';
import ManagerToolsView from './components/ManagerToolsView';
import RxDeskView from './components/RxDeskView';
import AdminToolsView from './components/AdminToolsView';
import ProfileView from './components/ProfileView';

// Nav icons
import { 
  LayoutDashboard, Package, ShoppingCart, Truck, 
  Users, FileText, Search, FileBarChart2, ShieldAlert,
  ChevronLeft, ChevronRight, Menu, LogIn, LogOut, TrendingUp,
  Calendar, RotateCcw, Sparkles, Lock, X, User, Bell as BellIcon, ClipboardList, Activity as ActivityIcon, Settings as SettingsIcon, CircleUserRound
} from 'lucide-react';

const ROLE_ACCESS: Record<string, string[]> = {
  Admin: ['dashboard', 'inventory', 'sales', 'profit', 'suppliers', 'customers', 'prescriptions', 'assistant', 'prediction', 'reports', 'scheduler', 'admin-users', 'admin-roles', 'admin-audit', 'admin-health', 'admin-settings', 'admin-profile'],
  Pharmacist: ['dashboard', 'sales', 'customers', 'prescriptions', 'assistant', 'inventory', 'rx-requests', 'rx-refills', 'rx-medicine-search', 'rx-notifications', 'rx-reports', 'rx-profile'],
  Manager: ['dashboard', 'inventory', 'profit', 'suppliers', 'reports', 'prediction', 'customers', 'prescriptions', 'scheduler', 'manager-analytics', 'reorder', 'manager-notifications', 'scheduler-status', 'manager-profile'],
  Patient: ['assistant', 'patient-portal']
};

export default function App() {
  // Main Tab controller
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Authentication & Session Guard States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('pharmasense_logged_in') === 'true';
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('pharmasense_user_email') || 'tiwinprasath056@gmail.com';
  });
  const [userRole, setUserRole] = useState<string>(() => {
    return localStorage.getItem('pharmasense_user_role') || 'Admin';
  });
  const [profileDetails, setProfileDetails] = useState<Partial<UserAccount>>({});

  const allowedTabs = ROLE_ACCESS[userRole] || ROLE_ACCESS.Admin;
  const navigateToAllowedTab = (tab: string) => {
    if (allowedTabs.includes(tab)) setActiveTab(tab);
  };

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0]);
  }, [userRole, activeTab, allowedTabs]);

  const handleLoginSuccess = (email: string, role: string, details?: Partial<UserAccount>) => {
    localStorage.setItem('pharmasense_logged_in', 'true');
    localStorage.setItem('pharmasense_user_email', email);
    localStorage.setItem('pharmasense_user_role', role);
    setIsLoggedIn(true);
    setUserEmail(email);
    setUserRole(role);
    setProfileDetails(details || {});
  };

  const handleLogout = () => {
    localStorage.removeItem('pharmasense_logged_in');
    localStorage.removeItem('pharmasense_user_email');
    localStorage.removeItem('pharmasense_user_role');
    setIsLoggedIn(false);
    setIsLocked(false);
  };

  const handleProfileSave = (details: Partial<UserAccount>) => {
    const updatedUser = { ...(currentUser || { email: userEmail, name: userEmail, role: userRole, passwordHash: '' }), ...details };
    setProfileDetails(details);
    setUsers(prev => prev.some(user => user.email.toLowerCase() === userEmail.toLowerCase())
      ? prev.map(user => user.email.toLowerCase() === userEmail.toLowerCase() ? { ...user, ...details } : user)
      : [...prev, updatedUser]);
  };

  // Automated Secure Terminal Locking
  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isLoggedIn) {
        setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn]);

  // Dynamic Current Operating System Date
  const [currentSystemDate, setCurrentSystemDate] = useState<string>(() => {
    return localStorage.getItem('pharmasense_system_date') || new Date().toISOString().split('T')[0];
  });

  // Core Reactive Database State (loading from localStorage, starting empty/fresh to clear previously stored data)
  const [medicines, setMedicines] = useState<MedicineMaster[]>(() => {
    const val = localStorage.getItem('pharmasense_medicines');
    return val ? JSON.parse(val) : INITIAL_MEDICINES;
  });
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const val = localStorage.getItem('pharmasense_inventory');
    return val ? JSON.parse(val) : [];
  });
  const [sales, setSales] = useState<Sale[]>(() => {
    const val = localStorage.getItem('pharmasense_sales');
    return val ? JSON.parse(val) : [];
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const val = localStorage.getItem('pharmasense_suppliers');
    return val ? JSON.parse(val) : INITIAL_SUPPLIERS;
  });
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const val = localStorage.getItem('pharmasense_customers');
    return val ? JSON.parse(val) : [];
  });
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(() => {
    const val = localStorage.getItem('pharmasense_prescriptions');
    return val ? JSON.parse(val) : [];
  });
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const val = localStorage.getItem('pharmasense_notifications');
    return val ? JSON.parse(val) : [];
  });
  const [schedulerLogs, setSchedulerLogs] = useState<SchedulerLog[]>(() => {
    const val = localStorage.getItem('pharmasense_scheduler_logs');
    return val ? JSON.parse(val) : [];
  });
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const value = localStorage.getItem('pharmasense_users');
    return value ? JSON.parse(value) : [];
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const value = localStorage.getItem('pharmasense_audit_logs');
    return value ? JSON.parse(value) : [];
  });
  const currentUser = users.find(user => user.email.toLowerCase() === userEmail.toLowerCase());
  const profileUser = { ...currentUser, ...profileDetails };
  const currentCustomer = customers.find(customer => customer.email?.toLowerCase() === userEmail.toLowerCase());
  const profileTab = userRole === 'Admin' ? 'admin-profile' : userRole === 'Manager' ? 'manager-profile' : userRole === 'Pharmacist' ? 'rx-profile' : 'patient-portal';
  const [medicineRequests, setMedicineRequests] = useState<MedicineRequest[]>([]);
  const [refillRequests, setRefillRequests] = useState<RefillRequest[]>([]);
  const [reminders, setReminders] = useState<MedicineReminder[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [feedback, setFeedback] = useState<PatientFeedback[]>([]);

  // Backend Integration: connection status + guard flag so we don't push
  // locally-cached (localStorage) data back up to the API before we've had
  // a chance to load the authoritative copy from the server.
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const hasHydratedFromBackend = React.useRef(false);

  // On first mount, pull the latest state from the backend API. If the
  // request succeeds, the server's copy becomes the source of truth and
  // overwrites whatever was loaded from localStorage above. If the backend
  // is unreachable, the app keeps working entirely off localStorage.
  useEffect(() => {
    let cancelled = false;
    fetchState()
      .then((state) => {
        if (cancelled) return;
        setMedicines(state.medicines.length ? state.medicines : INITIAL_MEDICINES);
        setInventory(state.inventory);
        setSales(state.sales);
        setSuppliers(state.suppliers.length ? state.suppliers : INITIAL_SUPPLIERS);
        setCustomers(state.customers);
        setPrescriptions(state.prescriptions);
        setNotifications(state.notifications);
        setSchedulerLogs(state.schedulerLogs);
        setUsers(state.users || []);
        setAuditLogs(state.auditLogs || []);
        setMedicineRequests(state.medicineRequests || []);
        setRefillRequests(state.refillRequests || []);
        setReminders(state.reminders || []);
        setSupportTickets(state.supportTickets || []);
        setFeedback(state.feedback || []);
        setBackendStatus('online');
      })
      .catch((err) => {
        console.warn('Backend unavailable, continuing in local-only mode:', err.message);
        if (!cancelled) setBackendStatus('offline');
      })
      .finally(() => {
        if (!cancelled) hasHydratedFromBackend.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save changes automatically to localStorage (fast local cache / offline fallback)
  // and mirror every change up to the backend API once it has been reached at least once.
  useEffect(() => {
    localStorage.setItem('pharmasense_medicines', JSON.stringify(medicines));
    if (hasHydratedFromBackend.current) {
      api.saveMedicines(medicines).catch((err) => console.warn('Failed to sync medicines to backend:', err.message));
    }
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem('pharmasense_inventory', JSON.stringify(inventory));
    if (hasHydratedFromBackend.current) {
      api.saveInventory(inventory).catch((err) => console.warn('Failed to sync inventory to backend:', err.message));
    }
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('pharmasense_sales', JSON.stringify(sales));
    if (hasHydratedFromBackend.current) {
      api.saveSales(sales).catch((err) => console.warn('Failed to sync sales to backend:', err.message));
    }
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('pharmasense_suppliers', JSON.stringify(suppliers));
    if (hasHydratedFromBackend.current) {
      api.saveSuppliers(suppliers).catch((err) => console.warn('Failed to sync suppliers to backend:', err.message));
    }
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('pharmasense_customers', JSON.stringify(customers));
    if (hasHydratedFromBackend.current) {
      api.saveCustomers(customers).catch((err) => console.warn('Failed to sync customers to backend:', err.message));
    }
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('pharmasense_prescriptions', JSON.stringify(prescriptions));
    if (hasHydratedFromBackend.current) {
      api.savePrescriptions(prescriptions).catch((err) => console.warn('Failed to sync prescriptions to backend:', err.message));
    }
  }, [prescriptions]);

  useEffect(() => {
    localStorage.setItem('pharmasense_notifications', JSON.stringify(notifications));
    if (hasHydratedFromBackend.current) {
      api.saveNotifications(notifications).catch((err) => console.warn('Failed to sync notifications to backend:', err.message));
    }
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('pharmasense_scheduler_logs', JSON.stringify(schedulerLogs));
    if (hasHydratedFromBackend.current) {
      api.saveSchedulerLogs(schedulerLogs).catch((err) => console.warn('Failed to sync scheduler logs to backend:', err.message));
    }
  }, [schedulerLogs]);

  useEffect(() => { if (hasHydratedFromBackend.current) api.saveMedicineRequests(medicineRequests).catch(() => {}); }, [medicineRequests]);
  useEffect(() => { if (hasHydratedFromBackend.current) api.saveRefillRequests(refillRequests).catch(() => {}); }, [refillRequests]);
  useEffect(() => { if (hasHydratedFromBackend.current) api.saveReminders(reminders).catch(() => {}); }, [reminders]);
  useEffect(() => { if (hasHydratedFromBackend.current) api.saveSupportTickets(supportTickets).catch(() => {}); }, [supportTickets]);
  useEffect(() => { if (hasHydratedFromBackend.current) api.saveFeedback(feedback).catch(() => {}); }, [feedback]);
  useEffect(() => { localStorage.setItem('pharmasense_users', JSON.stringify(users)); if (hasHydratedFromBackend.current) api.saveUsers(users).catch(() => {}); }, [users]);
  useEffect(() => { localStorage.setItem('pharmasense_audit_logs', JSON.stringify(auditLogs)); if (hasHydratedFromBackend.current) api.saveAuditLogs(auditLogs).catch(() => {}); }, [auditLogs]);

  // Database State resetting and Demo seeding functions
  const handleResetAllData = () => {
    setInventory([]);
    setSales([]);
    setCustomers([]);
    setPrescriptions([]);
    setNotifications([
      {
        id: `NOT-RESET-${Date.now()}`,
        type: 'restock',
        title: 'Database Slate Cleared',
        message: 'All pre-existing stock batches, checkout transactions, patients, prescriptions, and log history have been successfully wiped to form a blank slate.',
        date: currentSystemDate,
        isRead: false,
        severity: 'info'
      }
    ]);
    setSchedulerLogs([]);
    setMedicines(INITIAL_MEDICINES);
    setSuppliers(INITIAL_SUPPLIERS);
  };

  const handleLoadDemoDataset = () => {
    setMedicines(INITIAL_MEDICINES);
    setInventory(INITIAL_INVENTORY);
    setSales(INITIAL_SALES);
    setSuppliers(INITIAL_SUPPLIERS);
    setCustomers(INITIAL_CUSTOMERS);
    setPrescriptions(INITIAL_PRESCRIPTIONS);
    setSchedulerLogs(INITIAL_SCHEDULER_LOGS);
    setNotifications([
      {
        id: `NOT-DEMO-${Date.now()}`,
        type: 'restock',
        title: 'Showcase Dataset Loaded',
        message: 'The baseline pre-populated database containing mock transactions and inventory structures has been successfully restored for live preview and testing.',
        date: currentSystemDate,
        isRead: false,
        severity: 'info'
      }
    ]);
  };

  // State callbacks to link components
  // 1. Add Medicine to master formulary
  const handleAddMedicine = (newMed: Omit<MedicineMaster, 'id'>) => {
    const newId = `MED-0${medicines.length + 1}`;
    const formattedMed: MedicineMaster = {
      ...newMed,
      id: newId
    };
    setMedicines([...medicines, formattedMed]);

    // Send a system alert
    const dateStr = currentSystemDate;
    const newNoti: Notification = {
      id: `NOT-0${Date.now()}`,
      type: 'restock',
      title: 'New Formulary Medicine Added',
      message: `Medicine brand "${newMed.name}" (${newMed.genericName}) has been added to the master list.`,
      date: dateStr,
      isRead: false,
      severity: 'info'
    };
    setNotifications([newNoti, ...notifications]);
  };

  // 2. Add Inward Stock Batch
  const handleAddInventoryBatch = (newBatch: Omit<InventoryItem, 'id' | 'status'>) => {
    const newId = `INV-0${inventory.length + 1}`;
    
    // Calculate status relative to current date
    const currentDate = new Date(currentSystemDate);
    const expDate = new Date(newBatch.expiryDate);
    const diffDays = Math.ceil((expDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    
    let status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired' = 'In Stock';
    if (diffDays <= 0) {
      status = 'Expired';
    } else if (newBatch.currentQuantity === 0) {
      status = 'Out of Stock';
    } else if (newBatch.currentQuantity <= newBatch.reorderLevel) {
      status = 'Low Stock';
    }

    const formattedBatch: InventoryItem = {
      ...newBatch,
      id: newId,
      status
    };
    setInventory([formattedBatch, ...inventory]);

    // Update Supplier purchase history count
    setSuppliers(prev => prev.map(s => {
      if (s.id === newBatch.supplierId) {
        return { ...s, purchaseHistoryCount: s.purchaseHistoryCount + 1 };
      }
      return s;
    }));

    // Post alert
    const newNoti: Notification = {
      id: `NOT-0${Date.now()}`,
      type: 'restock',
      title: 'Inward Stock Arrived',
      message: `Successfully received ${newBatch.currentQuantity} units of Batch ${newBatch.batchNumber} at shelf ${newBatch.warehouseLocation}.`,
      date: currentSystemDate,
      isRead: false,
      severity: 'info'
    };
    setNotifications([newNoti, ...notifications]);
  };

  // 3. Remove/Quarantine Batch
  const handleRemoveBatch = (batchId: string) => {
    const target = inventory.find(i => i.id === batchId);
    if (!target) return;
    
    const med = medicines.find(m => m.id === target.medicineId);
    const isExpired = target.status === 'Expired';

    setInventory(inventory.filter(i => i.id !== batchId));

    // Post notification
    const newNoti: Notification = {
      id: `NOT-0${Date.now()}`,
      type: isExpired ? 'expired' : 'restock',
      title: isExpired ? 'Expired Batch Quarantined' : 'Stock Batch Removed',
      message: `Batch ${target.batchNumber} of ${med?.name || 'Unknown'} (${target.currentQuantity} units) was removed from warehouse shelving.`,
      date: currentSystemDate,
      isRead: false,
      severity: 'info'
    };
    setNotifications([newNoti, ...notifications]);
  };

  // 4. Record Checkout POS Sales & Decrement Stock
  const handleRecordSale = (saleData: Omit<Sale, 'id' | 'totalAmount'>) => {
    const billId = `BIL-${Math.floor(100000 + Math.random() * 900000)}`;
    const medCost = saleData.price * saleData.quantity;
    const discountVal = medCost * (saleData.discount / 100);
    const finalAmount = medCost - discountVal;

    const formattedSale: Sale = {
      ...saleData,
      id: billId,
      totalAmount: finalAmount
    };

    setSales([formattedSale, ...sales]);

    // Decrement stock batch quantity
    setInventory(prev => prev.map(item => {
      if (item.medicineId === saleData.medicineId && item.batchNumber === saleData.batchNumber) {
        const remaining = Math.max(0, item.currentQuantity - saleData.quantity);
        let updatedStatus = item.status;
        if (remaining === 0) {
          updatedStatus = 'Out of Stock';
        } else if (remaining <= item.reorderLevel) {
          updatedStatus = 'Low Stock';
        }
        return {
          ...item,
          currentQuantity: remaining,
          status: updatedStatus
        };
      }
      return item;
    }));

    // Update Customer Profile history if linked
    if (saleData.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === saleData.customerId) {
          return {
            ...c,
            purchaseHistoryIds: [...c.purchaseHistoryIds, billId]
          };
        }
        return c;
      }));
    }
  };

  // 5. Onboard Supplier
  const handleAddSupplier = (newSupp: Omit<Supplier, 'id' | 'purchaseHistoryCount'>) => {
    const newId = `SUP-0${suppliers.length + 1}`;
    const formattedSupp: Supplier = {
      ...newSupp,
      id: newId,
      purchaseHistoryCount: 0
    };
    setSuppliers([...suppliers, formattedSupp]);
  };

  // 6. Onboard Customer
  const handleAddCustomer = (newCust: Omit<Customer, 'id' | 'purchaseHistoryIds' | 'prescriptionHistory'>) => {
    const newId = `CUS-0${customers.length + 1}`;
    const formattedCust: Customer = {
      ...newCust,
      id: newId,
      purchaseHistoryIds: [],
      prescriptionHistory: []
    };
    setCustomers([...customers, formattedCust]);
  };

  const handlePatientPrescriptionSubmit = (prescription: Omit<Prescription, 'id' | 'status'>, patientEmail: string, customerId?: string) => {
    const newPrescription: Prescription = {
      ...prescription,
      patientEmail,
      id: `PRX-PATIENT-${Date.now()}`,
      status: 'Pending'
    };
    setPrescriptions(prev => [newPrescription, ...prev]);
    setNotifications(prev => [{
      id: `NOT-PATIENT-${Date.now()}`,
      type: 'prescription',
      title: 'Prescription submitted',
      message: 'Your prescription was submitted and is waiting for pharmacy review.',
      date: currentSystemDate,
      isRead: false,
      severity: 'info',
      patientEmail,
      customerId
    }, ...prev]);
  };

  const addMedicineRequest = (request: Omit<MedicineRequest, 'id' | 'createdAt' | 'status'>) => setMedicineRequests(prev => [{ ...request, id: `REQ-${Date.now()}`, createdAt: currentSystemDate, status: 'Pending' }, ...prev]);
  const addRefillRequest = (request: Omit<RefillRequest, 'id' | 'createdAt' | 'status'>) => setRefillRequests(prev => [{ ...request, id: `REF-${Date.now()}`, createdAt: currentSystemDate, status: 'Pending' }, ...prev]);
  const addReminder = (reminder: Omit<MedicineReminder, 'id'>) => setReminders(prev => [{ ...reminder, id: `REM-${Date.now()}` }, ...prev]);
  const updateReminder = (id: string, enabled: boolean) => setReminders(prev => prev.map(reminder => reminder.id === id ? { ...reminder, enabled } : reminder));
  const addSupportTicket = (ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>) => setSupportTickets(prev => [{ ...ticket, id: `SUP-${Date.now()}`, createdAt: currentSystemDate, status: 'Open' }, ...prev]);
  const addFeedback = (entry: Omit<PatientFeedback, 'id' | 'createdAt'>) => setFeedback(prev => [{ ...entry, id: `FDB-${Date.now()}`, createdAt: currentSystemDate }, ...prev]);

  const addAuditLog = (action: string, module: string, description: string, result: AuditLog['result'] = 'Success') => setAuditLogs(prev => [{ id: `AUD-${Date.now()}`, userEmail, role: userRole, action, module, description, result, timestamp: new Date().toISOString() }, ...prev]);
  const addAdminUser = (user: UserAccount) => {
    if (users.some(existing => existing.email.toLowerCase() === user.email.toLowerCase())) return;
    setUsers(prev => [...prev, user]);
    addAuditLog('User created', 'User Management', `Created ${user.role} account for ${user.email}`);
  };
  const changeUserRole = (email: string, role: string) => {
    const target = users.find(user => user.email === email);
    if (!target || (target.role === 'Admin' && role !== 'Admin' && users.filter(user => user.role === 'Admin' && user.active !== false).length <= 1)) return;
    setUsers(prev => prev.map(user => user.email === email ? { ...user, role } : user));
    addAuditLog('Role changed', 'User Management', `${email}: ${target.role} -> ${role}`);
  };
  const toggleUserActive = (email: string) => {
    const target = users.find(user => user.email === email);
    if (!target || (target.role === 'Admin' && target.active !== false && users.filter(user => user.role === 'Admin' && user.active !== false).length <= 1)) return;
    setUsers(prev => prev.map(user => user.email === email ? { ...user, active: user.active === false } : user));
    addAuditLog(target.active === false ? 'User activated' : 'User deactivated', 'User Management', email);
  };

  const updateMedicineRequest = (id: string, status: MedicineRequest['status']) => {
    setMedicineRequests(prev => prev.map(request => request.id === id ? { ...request, status } : request));
    const request = medicineRequests.find(item => item.id === id);
    if (request) setNotifications(prev => [{ id: `NOT-RX-${Date.now()}`, type: 'prescription', title: 'Medicine request updated', message: `Your medicine request is now ${status}.`, date: currentSystemDate, isRead: false, severity: 'info', patientEmail: request.patientEmail, medicineIds: [request.medicineId] }, ...prev]);
  };

  const updateRefillRequest = (id: string, status: RefillRequest['status']) => {
    setRefillRequests(prev => prev.map(request => request.id === id ? { ...request, status } : request));
    const request = refillRequests.find(item => item.id === id);
    if (request) setNotifications(prev => [{ id: `NOT-RX-${Date.now()}`, type: 'prescription', title: 'Refill request updated', message: `Your refill request is now ${status}.`, date: currentSystemDate, isRead: false, severity: 'info', patientEmail: request.patientEmail, medicineIds: [request.medicineId] }, ...prev]);
  };

  const updatePrescriptionStatus = (id: string, status: Prescription['status'], note = '') => {
    setPrescriptions(prev => prev.map(prescription => prescription.id === id ? { ...prescription, status } : prescription));
    const prescription = prescriptions.find(item => item.id === id);
    if (prescription?.patientEmail) setNotifications(prev => [{ id: `NOT-RX-${Date.now()}`, type: 'prescription', title: `Prescription ${status}`, message: note || `Your prescription is now ${status}.`, date: currentSystemDate, isRead: false, severity: status === 'Rejected' ? 'warning' : 'info', patientEmail: prescription.patientEmail }, ...prev]);
  };

  // 7. Dispense Prescription & auto-populate POS
  const handleDispensePrescription = (prescriptionId: string, itemsToCart: Array<{ medicine: MedicineMaster; batch: InventoryItem; quantity: number }>) => {
    // Mark prescription as Dispensed
    setPrescriptions(prev => prev.map(p => {
      if (p.id === prescriptionId) {
        return { ...p, status: 'Dispensed' };
      }
      return p;
    }));

    // Perform actual checkout sale deduction for each item instantly!
    itemsToCart.forEach(item => {
      handleRecordSale({
        medicineId: item.medicine.id,
        batchNumber: item.batch.batchNumber,
        customerName: 'Prescription Filled Patient',
        date: currentSystemDate,
        quantity: item.quantity,
        price: item.batch.sellingPrice,
        discount: 0,
        gst: item.medicine.gst,
        paymentMethod: 'UPI'
      });
    });

    // Notify success
    const newNoti: Notification = {
      id: `NOT-0${Date.now()}`,
      type: 'restock',
      title: 'Prescription Dispensed',
      message: `Successfully filled and billed Prescription ${prescriptionId}. Active stock counts adjusted.`,
      date: currentSystemDate,
      isRead: false,
      severity: 'info',
      patientEmail: prescriptions.find((prescription) => prescription.id === prescriptionId)?.patientEmail
    };
    setNotifications([newNoti, ...notifications]);
  };

  // 8. Trigger scheduler daily scan (Automation Simulation)
  const handleTriggerDailyScan = () => {
    const currentDate = new Date(currentSystemDate);
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let lowStockCount = 0;

    // Run audit logic & update inventory statuses
    const updatedInventory = inventory.map(item => {
      const expDate = new Date(item.expiryDate);
      const diffDays = Math.ceil((expDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired' = 'In Stock';
      if (diffDays <= 0) {
        status = 'Expired';
        expiredCount++;
      } else if (item.currentQuantity === 0) {
        status = 'Out of Stock';
        lowStockCount++;
      } else if (item.currentQuantity <= item.reorderLevel) {
        status = 'Low Stock';
        lowStockCount++;
      }

      if (diffDays > 0 && diffDays <= 90) {
        nearExpiryCount++;
      }

      return {
        ...item,
        status
      };
    });

    setInventory(updatedInventory);

    // Create a new log
    const logId = `LOG-0${schedulerLogs.length + 1}`;
    const newLog: SchedulerLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      runDate: currentSystemDate,
      checkedMedicinesCount: medicines.length,
      expiredFound: expiredCount,
      nearExpiryFound: nearExpiryCount,
      lowStockFound: lowStockCount,
      status: expiredCount > 0 ? 'Warning' : 'Success'
    };

    setSchedulerLogs([newLog, ...schedulerLogs]);

    // Create new critical notifications if expiries found
    if (expiredCount > 0) {
      const newNoti: Notification = {
        id: `NOT-CRON-${Date.now()}`,
        type: 'expired',
        title: 'Scheduler Expiry Alert',
        message: `Sweep finished. Detected ${expiredCount} expired medicine batches in physical inventory. Move to Quarantine Bin.`,
        date: currentSystemDate,
        isRead: false,
        severity: 'error'
      };
      setNotifications(prev => [newNoti, ...prev]);
    }
  };

  // 9. Manage Notifications read status
  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  // Navigation map
  const adminToolProps = {
    userEmail,
    users,
    medicines,
    inventory,
    sales,
    customers,
    prescriptions,
    medicineRequests,
    notifications,
    schedulerLogs,
    auditLogs,
    onAddUser: addAdminUser,
    onChangeRole: changeUserRole,
    onToggleUser: toggleUserActive
  };

  const managerToolProps = {
    userEmail,
    medicines,
    inventory,
    sales,
    suppliers,
    prescriptions,
    notifications,
    schedulerLogs,
    medicineRequests
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        if (userRole === 'Admin') return <AdminToolsView mode="dashboard" {...adminToolProps} />;
        if (userRole === 'Manager') return <ManagerToolsView mode="dashboard" {...managerToolProps} />;
        if (userRole === 'Pharmacist') return <RxDeskView mode="dashboard" userEmail={userEmail} customers={customers} medicines={medicines} inventory={inventory} sales={sales} prescriptions={prescriptions} medicineRequests={medicineRequests} refillRequests={refillRequests} notifications={notifications} onUpdateMedicineRequest={updateMedicineRequest} onUpdateRefillRequest={updateRefillRequest} />;
        return (
          <DashboardView 
            medicines={medicines}
            inventory={inventory}
            sales={sales}
            suppliers={suppliers}
            notifications={notifications}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onClearAllNotifications={handleClearAllNotifications}
            onNavigateToTab={navigateToAllowedTab}
            currentSystemDate={currentSystemDate}
          />
        );
      case 'inventory':
        return (
          <InventoryView 
            medicines={medicines}
            inventory={inventory}
            suppliers={suppliers}
            readOnly={userRole === 'Pharmacist'}
            onAddMedicine={handleAddMedicine}
            onAddInventoryBatch={handleAddInventoryBatch}
            onRemoveBatch={handleRemoveBatch}
            currentSystemDate={currentSystemDate}
          />
        );
      case 'sales':
        return (
          <SalesView 
            medicines={medicines}
            inventory={inventory}
            sales={sales}
            customers={customers}
            onRecordSale={handleRecordSale}
            onNavigateToTab={navigateToAllowedTab}
            currentSystemDate={currentSystemDate}
          />
        );
      case 'profit':
        return (
          <ProfitView 
            medicines={medicines}
            inventory={inventory}
            sales={sales}
            onUpdateInventory={setInventory}
            onAddNotification={(newNoti) => {
              setNotifications(prev => [newNoti, ...prev]);
            }}
            currentSystemDate={currentSystemDate}
          />
        );
      case 'suppliers':
        return (
          <SupplierView 
            suppliers={suppliers}
            onAddSupplier={handleAddSupplier}
          />
        );
      case 'customers':
        return (
          <CustomerView 
            customers={customers}
            sales={sales}
            medicines={medicines}
            onAddCustomer={handleAddCustomer}
          />
        );
      case 'prescriptions':
        if (userRole === 'Manager') return <ManagerToolsView mode="prescription-overview" {...managerToolProps} />;
        return (
          <PrescriptionView 
            prescriptions={prescriptions}
            medicines={medicines}
            inventory={inventory}
            onDispensePrescription={handleDispensePrescription}
            onNavigateToTab={navigateToAllowedTab}
            onUpdateStatus={updatePrescriptionStatus}
          />
        );
      case 'rx-requests':
        return <RxDeskView mode="requests" userEmail={userEmail} customers={customers} medicines={medicines} inventory={inventory} sales={sales} prescriptions={prescriptions} medicineRequests={medicineRequests} refillRequests={refillRequests} notifications={notifications} onUpdateMedicineRequest={updateMedicineRequest} onUpdateRefillRequest={updateRefillRequest} />;
      case 'rx-refills':
        return <RxDeskView mode="refills" userEmail={userEmail} customers={customers} medicines={medicines} inventory={inventory} sales={sales} prescriptions={prescriptions} medicineRequests={medicineRequests} refillRequests={refillRequests} notifications={notifications} onUpdateMedicineRequest={updateMedicineRequest} onUpdateRefillRequest={updateRefillRequest} />;
      case 'rx-medicine-search':
        return <RxDeskView mode="medicine-search" userEmail={userEmail} customers={customers} medicines={medicines} inventory={inventory} sales={sales} prescriptions={prescriptions} medicineRequests={medicineRequests} refillRequests={refillRequests} notifications={notifications} onUpdateMedicineRequest={updateMedicineRequest} onUpdateRefillRequest={updateRefillRequest} />;
      case 'rx-notifications':
        return <RxDeskView mode="notifications" userEmail={userEmail} customers={customers} medicines={medicines} inventory={inventory} sales={sales} prescriptions={prescriptions} medicineRequests={medicineRequests} refillRequests={refillRequests} notifications={notifications} onUpdateMedicineRequest={updateMedicineRequest} onUpdateRefillRequest={updateRefillRequest} />;
      case 'rx-reports':
        return <RxDeskView mode="reports" userEmail={userEmail} customers={customers} medicines={medicines} inventory={inventory} sales={sales} prescriptions={prescriptions} medicineRequests={medicineRequests} refillRequests={refillRequests} notifications={notifications} onUpdateMedicineRequest={updateMedicineRequest} onUpdateRefillRequest={updateRefillRequest} />;
      case 'rx-profile':
        return <ProfileView user={profileUser as UserAccount} onSave={handleProfileSave} />;
      case 'assistant':
        return (
          <PharmacyAssistantView 
            medicines={medicines}
            inventory={inventory}
            suppliers={suppliers}
            role={userRole}
            patientMode={userRole === 'Patient'}
          />
        );
      case 'patient-portal':
        return (
          <PatientPortalView
            email={userEmail}
            customers={customers}
            sales={sales}
            medicines={medicines}
            prescriptions={prescriptions}
            notifications={notifications}
            onSubmitPrescription={handlePatientPrescriptionSubmit}
            medicineRequests={medicineRequests}
            refillRequests={refillRequests}
            reminders={reminders}
            supportTickets={supportTickets}
            onAddMedicineRequest={addMedicineRequest}
            onAddRefillRequest={addRefillRequest}
            onAddReminder={addReminder}
            onUpdateReminder={updateReminder}
            onAddSupportTicket={addSupportTicket}
            onAddFeedback={addFeedback}
            profileUser={profileUser as UserAccount}
            onSaveProfile={handleProfileSave}
          />
        );
      case 'prediction':
        return (
          <PredictionView 
            medicines={medicines}
            sales={sales}
            currentSystemDate={currentSystemDate}
            onAddNotification={(newNoti) => {
              setNotifications(prev => [newNoti, ...prev]);
            }}
          />
        );
      case 'reports':
        return (
          <ReportsView 
            medicines={medicines}
            inventory={inventory}
            sales={sales}
            suppliers={suppliers}
            customers={customers}
          />
        );
      case 'scheduler':
        if (userRole === 'Manager') return <ManagerToolsView mode="scheduler-status" {...managerToolProps} />;
        return (
          <SchedulerSimulator 
            logs={schedulerLogs}
            onTriggerDailyScan={handleTriggerDailyScan}
            currentSystemDate={currentSystemDate}
          />
        );
      case 'manager-analytics':
        return <ManagerToolsView mode="analytics" {...managerToolProps} />;
      case 'reorder':
        return <ManagerToolsView mode="reorder" {...managerToolProps} />;
      case 'manager-notifications':
        return <ManagerToolsView mode="notifications" {...managerToolProps} />;
      case 'scheduler-status':
        return <ManagerToolsView mode="scheduler-status" {...managerToolProps} />;
      case 'manager-profile':
        return <ProfileView user={profileUser as UserAccount} onSave={handleProfileSave} />;
      case 'admin-users':
        return <AdminToolsView mode="users" {...adminToolProps} />;
      case 'admin-roles':
        return <AdminToolsView mode="roles" {...adminToolProps} />;
      case 'admin-audit':
        return <AdminToolsView mode="audit" {...adminToolProps} />;
      case 'admin-health':
        return <AdminToolsView mode="health" {...adminToolProps} />;
      case 'admin-settings':
        return <AdminToolsView mode="settings" {...adminToolProps} />;
      case 'admin-profile':
        return <ProfileView user={profileUser as UserAccount} onSave={handleProfileSave} />;
      default:
        return <div className="text-center py-12 text-slate-400">View not constructed yet.</div>;
    }
  };

  if (!allowedTabs.includes(activeTab)) {
    return null;
  }

  // Nav menu helper
  const NAV_ITEMS = [
    { id: 'dashboard', label: userRole === 'Admin' ? 'Admin Dashboard' : userRole === 'Manager' ? 'Manager Dashboard' : userRole === 'Pharmacist' ? 'RX Desk Dashboard' : 'Operations Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: userRole === 'Pharmacist' ? 'Limited inventory viewing' : 'Smart Inventory', icon: Package },
    { id: 'sales', label: userRole === 'Admin' ? 'Billing' : 'POS Billing', icon: ShoppingCart },
    { id: 'profit', label: userRole === 'Admin' ? 'Profit & expiry' : 'Profit Analysis & Expiries', icon: TrendingUp },
    { id: 'suppliers', label: 'Supplier Hub', icon: Truck },
    { id: 'customers', label: userRole === 'Admin' ? 'Patients' : 'Patient Directory', icon: Users },
    { id: 'prescriptions', label: userRole === 'Admin' ? 'Prescriptions' : userRole === 'Manager' ? 'Prescription Overview' : 'Prescription Desk', icon: FileText },
    { id: 'assistant', label: 'Pharmacy Assistant', icon: Search },
    { id: 'prediction', label: userRole === 'Admin' ? 'AI Demand Prediction' : 'AI Medicine Demand Prediction', icon: Sparkles },
    { id: 'reports', label: userRole === 'Admin' ? 'Reports' : 'Reports & Spreadsheets', icon: FileBarChart2 },
    { id: 'scheduler', label: userRole === 'Admin' ? 'Scheduler' : userRole === 'Manager' ? 'Scheduler Status' : 'Scheduler status only', icon: ShieldAlert },
    { id: 'manager-analytics', label: 'Sales Analytics', icon: TrendingUp },
    { id: 'reorder', label: 'Reorder Recommendations', icon: Package },
    { id: 'manager-notifications', label: 'Notifications', icon: BellIcon },
    { id: 'manager-profile', label: 'Manager Profile', icon: User },
    { id: 'patient-portal', label: 'My prescriptions & billing', icon: User },
    { id: 'rx-requests', label: 'Medicine Requests', icon: Package },
    { id: 'rx-refills', label: 'Refill Requests', icon: ClipboardList },
    { id: 'rx-medicine-search', label: 'Medicine Search', icon: Search },
    { id: 'rx-notifications', label: 'Notifications', icon: BellIcon },
    { id: 'rx-reports', label: 'RX Desk Reports', icon: FileBarChart2 },
    { id: 'rx-profile', label: 'My Profile', icon: User },
    { id: 'admin-users', label: 'User Management', icon: Users },
    { id: 'admin-roles', label: 'Roles & Permissions', icon: ShieldAlert },
    { id: 'admin-audit', label: 'Audit Logs', icon: FileText },
    { id: 'admin-health', label: 'System Health', icon: ActivityIcon },
    { id: 'admin-settings', label: 'System Settings', icon: SettingsIcon },
    { id: 'admin-profile', label: 'Admin Profile', icon: User },
  ].filter((item) => allowedTabs.includes(item.id));

  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50/70 text-slate-800 antialiased font-sans relative">
      <AnimatePresence>
        {isLocked && (
          <LockScreen 
            userEmail={userEmail}
            onUnlock={() => setIsLocked(false)}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      {/* Mobile Top Header Bar (Android / Phone screens) */}
      <header className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between z-30 sticky top-0 shadow-md relative">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 bg-slate-800 text-slate-200 hover:text-white rounded-xl border border-slate-700/60 active:scale-95 transition-all cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-teal-500 flex items-center justify-center font-display font-extrabold text-white text-xs shrink-0">
              ✚
            </div>
            <div>
              <span className="font-display font-bold text-slate-100 text-xs block leading-tight tracking-tight uppercase">
                PharmeSense
              </span>
              <span className="text-[9px] text-teal-400 font-mono tracking-wider block uppercase font-bold">
                {NAV_ITEMS.find(i => i.id === activeTab)?.label || 'Management Desk'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLocked(true)}
            className="p-2 bg-slate-800 text-slate-300 hover:text-teal-400 rounded-xl border border-slate-700/60 active:scale-95 transition-all cursor-pointer"
            title="Lock Desk"
          >
            <Lock className="h-4 w-4" />
          </button>
          <button
            onClick={() => setProfileMenuOpen(open => !open)}
            className="h-9 w-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs border border-teal-400/40"
            title="Open user profile"
          >
            {profileUser.photoUrl ? <img src={profileUser.photoUrl} alt="Profile" className="h-full w-full rounded-full object-cover" /> : (profileUser.name || userEmail).slice(0, 2).toUpperCase()}
          </button>

          {notifications.filter(n => !n.isRead).length > 0 && (
            <button
              onClick={() => navigateToAllowedTab('dashboard')}
              className="px-2.5 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full font-mono text-[10px] font-bold animate-pulse flex items-center gap-1 cursor-pointer"
            >
              ⚠️ {notifications.filter(n => !n.isRead).length}
            </button>
          )}
        </div>
        {profileMenuOpen && (
          <div className="absolute right-4 top-16 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50">
            <p className="font-bold text-slate-800 truncate">{profileUser.name || 'User account'}</p>
            <p className="text-xs text-slate-400 truncate mt-1">{userEmail}</p>
            <div className="grid grid-cols-2 gap-3 py-3 mt-3 border-y border-slate-100 text-xs">
              <div><span className="text-[9px] uppercase text-slate-400 font-bold">Role</span><p className="font-bold text-slate-700 mt-1">{userRole}</p></div>
              <div><span className="text-[9px] uppercase text-slate-400 font-bold">Status</span><p className="font-bold text-emerald-600 mt-1">{profileUser.active === false ? 'Inactive' : 'Active'}</p></div>
              <div><span className="text-[9px] uppercase text-slate-400 font-bold">Phone</span><p className="font-bold text-slate-700 mt-1">{profileUser.phone || currentCustomer?.contactNumber || 'Not provided'}</p></div>
              <div><span className="text-[9px] uppercase text-slate-400 font-bold">Modules</span><p className="font-bold text-slate-700 mt-1">{allowedTabs.length}</p></div>
              <div className="col-span-2"><span className="text-[9px] uppercase text-slate-400 font-bold">Address</span><p className="font-bold text-slate-700 mt-1 truncate">{profileUser.address || 'Not provided'}</p></div>
              <div><span className="text-[9px] uppercase text-slate-400 font-bold">Date of birth</span><p className="font-bold text-slate-700 mt-1">{profileUser.dateOfBirth || 'Not provided'}</p></div>
              <div><span className="text-[9px] uppercase text-slate-400 font-bold">Employee ID</span><p className="font-bold text-slate-700 mt-1">{profileUser.employeeId || 'Not applicable'}</p></div>
            </div>
            <button onClick={() => { navigateToAllowedTab(profileTab); setProfileMenuOpen(false); }} className="w-full mt-3 px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold">Open profile</button>
            <button onClick={handleLogout} className="w-full mt-2 px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold">Sign out</button>
          </div>
        )}
      </header>

      {/* Mobile Slide-over Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Side Drawer Canvas */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-[280px] max-w-[85vw] bg-slate-900 border-r border-slate-800 text-white h-full flex flex-col justify-between z-10 shadow-2xl overflow-y-auto"
            >
              <div>
                {/* Mobile Drawer Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-teal-500 flex items-center justify-center font-display font-extrabold text-white text-sm shrink-0">
                      ✚
                    </div>
                    <div>
                      <span className="font-display font-extrabold text-slate-100 text-xs block tracking-tight uppercase">
                        PharmeSense
                      </span>
                      <span className="text-[9px] text-teal-400 font-mono uppercase font-bold block">
                        Mobile Terminal
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Mobile Nav Links */}
                <nav className="p-3 space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigateToAllowedTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                          isActive ? 
                          'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 
                          'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                        }`}
                      >
                        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Drawer Footer Controls */}
              <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/40">
                {/* Date Picker */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider font-mono mb-1">
                    Terminal System Date
                  </span>
                  <input 
                    type="date"
                    value={currentSystemDate}
                    onChange={(e) => {
                      setCurrentSystemDate(e.target.value);
                      localStorage.setItem('premier_pharmacy_system_date', e.target.value);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 font-mono font-bold text-xs rounded-lg p-2 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleResetAllData();
                      setMobileMenuOpen(false);
                    }}
                    className="py-2 bg-rose-950/40 border border-rose-900/30 text-rose-400 text-[10px] font-mono font-bold rounded-lg flex items-center justify-center gap-1 uppercase"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Wipe Slate
                  </button>
                  <button
                    onClick={() => {
                      handleLoadDemoDataset();
                      setMobileMenuOpen(false);
                    }}
                    className="py-2 bg-teal-950/40 border border-teal-900/30 text-teal-400 text-[10px] font-mono font-bold rounded-lg flex items-center justify-center gap-1 uppercase"
                  >
                    <Sparkles className="h-3 w-3" />
                    Seed Data
                  </button>
                </div>

                {/* Operator Logout */}
                <div className="pt-1">
                  <span className="text-[9px] text-slate-500 font-mono block truncate">Operator: {userEmail}</span>
                  <button 
                    onClick={handleLogout}
                    className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all uppercase text-[10px]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out Terminal
                  </button>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      
      {/* 1. Desktop Collapsible Sidebar (Desktop Viewports) */}
      <aside 
        className={`hidden lg:flex bg-slate-900 border-r border-slate-800 flex-col justify-between transition-all duration-300 z-30 shrink-0 select-none ${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}`}
      >
        <div>
          {/* Logo Brand Box */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
            <div className="h-9 w-9 rounded-xl bg-teal-500 flex items-center justify-center font-display font-extrabold text-white text-lg shrink-0">
              ✚
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="font-display font-extrabold text-slate-100 text-sm block tracking-tight uppercase">
                  PharmeSense
                </span>
                <span className="text-[10px] text-teal-400 font-mono tracking-wider block uppercase font-bold">
                  Management Desk
                </span>
              </div>
            )}
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateToAllowedTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all text-xs font-semibold cursor-pointer ${
                    isActive ? 
                    'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 
                    'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Collapsible toggle / footer info */}
        <div className="p-4 border-t border-slate-800 space-y-3.5">
          {!sidebarCollapsed && (
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800/60 font-mono text-[10px] text-slate-400">
              <span className="text-slate-500 uppercase tracking-wider block font-bold">Authenticated User</span>
              <span className="font-bold text-slate-300 block mt-1 truncate">{userEmail}</span>
              <span className="bg-teal-950 text-teal-400 font-bold px-1.5 py-0.2 rounded mt-1.5 inline-block uppercase text-[8px]">
                Role: {userRole}
              </span>
              <button 
                onClick={handleLogout}
                className="w-full mt-2.5 py-1.5 bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900 hover:border-rose-800 text-rose-400 font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all uppercase text-[8px]"
              >
                <LogOut className="h-3 w-3" />
                Sign Out Terminal
              </button>
            </div>
          )}

          {sidebarCollapsed && (
            <button 
              onClick={handleLogout}
              title="Sign Out Terminal"
              className="w-full py-2.5 bg-rose-950/40 border border-rose-900/30 hover:bg-rose-900 hover:border-rose-800 text-rose-400 rounded-xl flex items-center justify-center cursor-pointer transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700/60 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar (Desktop Viewports) */}
        <header className="hidden lg:flex bg-white border-b border-slate-100 px-6 py-3 flex-wrap gap-4 justify-between items-center z-10 sticky top-0 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-xs font-mono font-bold text-slate-500">TERMINAL REGISTRY: ACTIVE</span>
            <span 
              title={backendStatus === 'online' ? 'Connected to backend API' : backendStatus === 'offline' ? 'Backend unreachable — running on local cache only' : 'Connecting to backend API...'}
              className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-1 rounded-full border uppercase ${
                backendStatus === 'online' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                backendStatus === 'offline' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                backendStatus === 'online' ? 'bg-emerald-500' :
                backendStatus === 'offline' ? 'bg-amber-500' : 'bg-slate-400 animate-pulse'
              }`} />
              {backendStatus === 'online' ? 'API Connected' : backendStatus === 'offline' ? 'Offline Mode' : 'Connecting…'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            {/* Terminal Date Picker */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500 font-bold flex items-center gap-1 uppercase text-[10px]">
                <Calendar className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
                Terminal Date:
              </span>
              <input 
                type="date"
                value={currentSystemDate}
                onChange={(e) => {
                  setCurrentSystemDate(e.target.value);
                  localStorage.setItem('pharmasense_system_date', e.target.value);
                }}
                className="bg-transparent border-0 text-slate-700 font-mono font-bold text-xs focus:outline-none focus:ring-0 p-0 w-28 cursor-pointer"
              />
            </div>

            {/* Quick Slate Reset & Seed Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsLocked(true)}
                title="Manually secure and lock the operator session"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg font-bold transition-all cursor-pointer text-[10px] uppercase"
              >
                <Lock className="h-3 w-3 text-slate-600" />
                Lock Desk
              </button>
              <button
                onClick={handleResetAllData}
                title="Wipe all stock layers, POS bills, and logs"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-lg font-bold transition-all cursor-pointer text-[10px] uppercase"
              >
                <RotateCcw className="h-3 w-3" />
                Wipe Slate
              </button>
              <button
                onClick={handleLoadDemoDataset}
                title="Load standard showcase demo data for evaluation"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 hover:border-teal-300 rounded-lg font-bold transition-all cursor-pointer text-[10px] uppercase"
              >
                <Sparkles className="h-3 w-3" />
                Seed Showcase
              </button>
            </div>

            {notifications.filter(n => !n.isRead).length > 0 && (
              <span 
                onClick={() => navigateToAllowedTab('dashboard')}
                className="animate-pulse bg-rose-50 text-rose-600 border border-rose-100 font-bold px-3.5 py-1.5 rounded-full cursor-pointer flex items-center gap-1"
              >
                ⚠️ {notifications.filter(n => !n.isRead).length} Warnings
              </span>
            )}
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(open => !open)}
                  title="Open user profile"
                  aria-label="Open user profile"
                  className="h-9 w-9 flex items-center justify-center bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-full cursor-pointer transition-colors"
                >
                  <CircleUserRound className="h-5 w-5 text-teal-600" />
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <span className="h-11 w-11 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold overflow-hidden">{profileUser.photoUrl ? <img src={profileUser.photoUrl} alt="Profile" className="h-full w-full object-cover" /> : (profileUser.name || userEmail).slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0"><p className="font-bold text-slate-800 truncate">{profileUser.name || 'User account'}</p><p className="text-xs text-slate-400 truncate">{userEmail}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 py-3 text-xs">
                      <div><span className="text-[9px] uppercase text-slate-400 font-bold">Role</span><p className="font-bold text-slate-700 mt-1">{userRole}</p></div>
                      <div><span className="text-[9px] uppercase text-slate-400 font-bold">Status</span><p className="font-bold text-emerald-600 mt-1">{profileUser.active === false ? 'Inactive' : 'Active'}</p></div>
                      <div><span className="text-[9px] uppercase text-slate-400 font-bold">Phone</span><p className="font-bold text-slate-700 mt-1">{profileUser.phone || currentCustomer?.contactNumber || 'Not provided'}</p></div>
                      <div><span className="text-[9px] uppercase text-slate-400 font-bold">Access</span><p className="font-bold text-slate-700 mt-1">{allowedTabs.length} modules</p></div>
                      <div className="col-span-2"><span className="text-[9px] uppercase text-slate-400 font-bold">Address</span><p className="font-bold text-slate-700 mt-1 truncate">{profileUser.address || 'Not provided'}</p></div>
                      <div><span className="text-[9px] uppercase text-slate-400 font-bold">Date of birth</span><p className="font-bold text-slate-700 mt-1">{profileUser.dateOfBirth || 'Not provided'}</p></div>
                      <div><span className="text-[9px] uppercase text-slate-400 font-bold">Employee ID</span><p className="font-bold text-slate-700 mt-1">{profileUser.employeeId || 'Not applicable'}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { navigateToAllowedTab(profileTab); setProfileMenuOpen(false); }} className="flex-1 px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold">Open profile</button>
                      <button onClick={handleLogout} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold">Sign out</button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </header>

        {/* Dynamic Panel Container with Responsive Padding for Mobile & Android devices */}
        <div className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto pb-24 lg:pb-6">
          {renderActiveView()}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (Android Touch App Experience) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-2 py-1.5 flex justify-around items-center text-slate-400 backdrop-blur-md shadow-2xl">
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigateToAllowedTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                activeTab === item.id ? 'text-teal-400 font-bold' : 'hover:text-slate-200'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-mono tracking-tight max-w-20 truncate">{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[9px] font-mono tracking-tight">All Tabs</span>
        </button>
      </nav>
    </div>
  );
}
