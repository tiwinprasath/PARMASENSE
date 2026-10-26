import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bell, Building2, CalendarDays, Database, FileText, ShieldCheck, User, Users } from 'lucide-react';
import { AuditLog, Customer, InventoryItem, MedicineMaster, MedicineRequest, Notification, Prescription, SchedulerLog, Sale } from '../types';
import { UserAccount } from '../services/api';

type AdminMode = 'dashboard' | 'users' | 'roles' | 'audit' | 'health' | 'settings' | 'profile';
interface Props {
  mode: AdminMode; userEmail: string; users: UserAccount[]; medicines: MedicineMaster[]; inventory: InventoryItem[]; sales: Sale[]; customers: Customer[]; prescriptions: Prescription[]; medicineRequests: MedicineRequest[]; notifications: Notification[]; schedulerLogs: SchedulerLog[]; auditLogs: AuditLog[];
  onAddUser: (user: UserAccount) => void; onChangeRole: (email: string, role: string) => void; onToggleUser: (email: string) => void;
}
const roles = ['Admin', 'Manager', 'Pharmacist', 'Patient'];
const money = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function AdminToolsView(props: Props) {
  const { mode, users, medicines, inventory, sales, customers, prescriptions, medicineRequests, notifications, schedulerLogs, auditLogs, userEmail } = props;
  const [search, setSearch] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const roleCounts = roles.map(role => ({ role, count: users.filter(user => user.role === role).length }));
  const lowStock = inventory.filter(item => item.currentQuantity <= item.minimumStock);
  const expired = inventory.filter(item => new Date(item.expiryDate) <= new Date());
  const expiring = inventory.filter(item => { const days = (new Date(item.expiryDate).getTime() - Date.now()) / 86400000; return days > 0 && days <= 90; });
  const monthlyRevenue = sales.filter(item => item.date.startsWith(month)).reduce((sum, item) => sum + item.totalAmount, 0);

  if (mode === 'users') return <UsersPanel users={users} search={search} setSearch={setSearch} onAddUser={props.onAddUser} onChangeRole={props.onChangeRole} onToggleUser={props.onToggleUser} />;
  if (mode === 'roles') return <RolesPanel roleCounts={roleCounts} />;
  if (mode === 'audit') return <Panel title="Audit Logs"><Rows items={auditLogs} empty="No audit events recorded." render={log => <span><strong>{log.action} · {log.module}</strong><small>{log.description} · {log.userEmail} ({log.role})</small></span>} /></Panel>;
  if (mode === 'health') return <Panel title="System Health"><div className="grid md:grid-cols-2 gap-3">{['Backend API', 'Database', 'Notification service', `Scheduler (${schedulerLogs.length} runs)`, 'AI prediction service'].map(name => <div key={name} className="flex justify-between p-3 rounded-xl bg-emerald-50 text-sm"><span>{name}</span><b className="text-[10px] text-emerald-700">HEALTHY</b></div>)}</div><p className="text-xs text-slate-400 mt-4">Secrets and credentials are not exposed.</p></Panel>;
  if (mode === 'settings') return <SettingsPanel />;
  if (mode === 'profile') return <Panel title="Admin Profile"><div className="grid md:grid-cols-2 gap-4"><Info label="Role" value="Administrator" /><Info label="Email" value={userEmail} /><Info label="Access" value="Full system administration" /><Info label="Security" value="User and permission changes are Admin-only" /></div></Panel>;

  const stats = [
    ['Total users', users.length], ['Admins', roleCounts[0].count], ['Managers', roleCounts[1].count], ['RX Desk staff', roleCounts[2].count], ['Patients', roleCounts[3].count], ['Total medicines', medicines.length], ['Low stock', lowStock.length], ['Expiring', expiring.length], ['Expired', expired.length], ["Today's sales", sales.filter(item => item.date === today).length], ['Monthly revenue', money(monthlyRevenue)], ['Notifications', notifications.filter(item => !item.isRead).length]
  ];
  return <div className="space-y-5"><header className="bg-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-lg"><span className="text-[10px] font-mono font-bold uppercase tracking-widest text-teal-400">Administrator control center</span><h1 className="font-display text-2xl font-bold mt-2">Admin Dashboard</h1><p className="text-sm text-slate-400 mt-1">Users, permissions, operations, reports, health, and system oversight.</p></header><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{stats.map(([label, value]) => <div key={String(label)}><Metric label={String(label)} value={value} /></div>)}</div><div className="grid lg:grid-cols-2 gap-5"><Panel title="Role distribution"><Rows items={roleCounts} empty="No users." render={item => <><span>{item.role}</span><strong>{item.count}</strong></>} /></Panel><Panel title="Operational oversight"><Rows items={[['Pending prescriptions', prescriptions.filter(item => item.status === 'Pending').length], ['Pending medicine requests', medicineRequests.filter(item => item.status === 'Pending').length], ['Patients', customers.length], ['Scheduler runs', schedulerLogs.length]]} empty="No records." render={item => <><span>{item[0]}</span><strong>{item[1]}</strong></>} /></Panel></div><Panel title="System status"><div className="grid md:grid-cols-4 gap-3"><Metric label="Backend" value="Healthy" /><Metric label="Database" value="Connected" /><Metric label="Scheduler" value="Monitoring" /><Metric label="Audit log" value="Active" /></div></Panel></div>;
}

function UsersPanel({ users, search, setSearch, onAddUser, onChangeRole, onToggleUser }: { users: UserAccount[]; search: string; setSearch: (value: string) => void; onAddUser: (user: UserAccount) => void; onChangeRole: (email: string, role: string) => void; onToggleUser: (email: string) => void }) { const [showAdd, setShowAdd] = useState(false); const filtered = useMemo(() => users.filter(user => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(search.toLowerCase())), [users, search]); return <Panel title="User Management" action={<button onClick={() => setShowAdd(true)} className="primary">Add user</button>}><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users" className="field mb-4" /><Rows items={filtered} empty="No users found." render={user => <><span><strong>{user.name}</strong><small>{user.email} · {user.active === false ? 'Inactive' : 'Active'}</small></span><span className="flex items-center gap-2"><select value={user.role} onChange={event => onChangeRole(user.email, event.target.value)} className="field w-auto py-1"><option>Admin</option><option>Manager</option><option>Pharmacist</option><option>Patient</option></select><button onClick={() => onToggleUser(user.email)} className="text-xs font-bold text-teal-700">{user.active === false ? 'Activate' : 'Deactivate'}</button></span></>} />{showAdd && <AddUser onAdd={user => { onAddUser(user); setShowAdd(false); }} close={() => setShowAdd(false)} />}</Panel>; }
function AddUser({ onAdd, close }: { onAdd: (user: UserAccount) => void; close: () => void }) { const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState('Patient'); return <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"><form onSubmit={event => { event.preventDefault(); onAdd({ name, email, role, passwordHash: 'ChangeMe123', active: true }); }} className="bg-white p-5 rounded-2xl w-full max-w-md space-y-3"><div className="flex justify-between"><h3 className="font-bold">Add user</h3><button type="button" onClick={close}>Close</button></div><input required value={name} onChange={event => setName(event.target.value)} placeholder="Full name" className="field" /><input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" className="field" /><select value={role} onChange={event => setRole(event.target.value)} className="field"><option>Patient</option><option>Pharmacist</option><option>Manager</option><option>Admin</option></select><button className="primary">Create user</button></form></div>; }
function RolesPanel({ roleCounts }: { roleCounts: Array<{ role: string; count: number }> }) { const permissions: Record<string, string[]> = { Admin: ['Full system access', 'Users and roles', 'Settings and audit', 'Scheduler controls'], Manager: ['Inventory', 'Suppliers', 'Sales and profit', 'AI predictions and reports'], Pharmacist: ['Prescriptions', 'Patients', 'Dispensing', 'Requests and billing'], Patient: ['Own portal', 'Own prescriptions', 'Requests', 'Reminders and assistant'] }; return <Panel title="Roles & Permissions"><div className="grid md:grid-cols-2 gap-3">{roleCounts.map(item => <div key={item.role} className="p-4 rounded-xl bg-slate-50"><div className="flex justify-between"><strong>{item.role}</strong><span className="text-xs text-slate-400">{item.count} users</span></div><ul className="mt-2 space-y-1">{permissions[item.role].map(permission => <li key={permission} className="text-xs text-slate-600">✓ {permission}</li>)}</ul></div>)}</div></Panel>; }
function SettingsPanel() {
  const [days, setDays] = useState(localStorage.getItem('pharmasense_expiry_warning_days') || '90');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const saveExpiryWarning = () => {
    const value = Number(days);
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      setError('Enter a whole number between 1 and 365 days.');
      setSaved(false);
      return;
    }
    localStorage.setItem('pharmasense_expiry_warning_days', String(value));
    setDays(String(value));
    setError('');
    setSaved(true);
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-teal-50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">Administration</p>
            <h1 className="mt-1 font-display text-xl font-bold text-slate-900">System Settings</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Configure operational defaults and review the regional settings used across the pharmacy workspace.
            </p>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display font-bold text-slate-900">Inventory alerts</h2>
              <p className="mt-0.5 text-xs text-slate-500">Set when staff should be warned about upcoming expiry.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-xs font-semibold text-slate-700">
              Expiry warning period
              <span className="relative mt-1.5 block">
                <input
                  value={days}
                  onChange={event => { setDays(event.target.value); setSaved(false); setError(''); }}
                  onKeyDown={event => { if (event.key === 'Enter') saveExpiryWarning(); }}
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  inputMode="numeric"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'expiry-warning-error' : 'expiry-warning-help'}
                  className="field w-full pr-16"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">days</span>
              </span>
            </label>
            <button type="button" onClick={saveExpiryWarning} className="primary min-h-10 w-full sm:w-auto">
              Save setting
            </button>
          </div>
          {error ? (
            <p id="expiry-warning-error" role="alert" className="mt-2 text-xs font-medium text-rose-600">{error}</p>
          ) : (
            <p id="expiry-warning-help" className="mt-2 text-xs text-slate-500">Choose a period from 1 to 365 days before expiry.</p>
          )}
          {saved && <p role="status" className="mt-3 text-xs font-semibold text-emerald-700">Expiry warning period saved.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h2 className="font-display font-bold text-slate-900">Workspace defaults</h2>
            <p className="mt-1 text-xs text-slate-500">Current configuration applied throughout the system.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <SettingInfo icon={Building2} label="Pharmacy" value="PharmaSense Pharmacy" detail="Workspace name" />
            <SettingInfo icon={Database} label="Currency" value="INR (₹)" detail="Indian Rupee" />
            <SettingInfo icon={Bell} label="Notifications" value="Operational alerts enabled" detail="Inventory and workflow updates" />
          </div>
        </section>
      </div>
    </div>
  );
}
function SettingInfo({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"><div className="flex justify-between items-center gap-3 mb-4"><h2 className="font-display font-bold text-slate-900">{title}</h2>{action}</div>{children}</section>; }
function Metric({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string | number }) { return <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm"><div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div><strong className="block text-xl mt-2 text-slate-800">{value}</strong></div>; }
function Rows({ items, empty, render }: { items: unknown[]; empty: string; render: (item: any) => React.ReactNode }) { return items.length ? <div className="space-y-2">{items.map((item, index) => <div key={index} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl text-sm text-slate-700">{render(item)}</div>)}</div> : <p className="text-sm text-slate-400">{empty}</p>; }
function Info({ label, value }: { label: string; value: string }) { return <div><span className="text-[10px] uppercase font-bold text-slate-400">{label}</span><p className="text-sm text-slate-700 mt-1">{value}</p></div>; }
