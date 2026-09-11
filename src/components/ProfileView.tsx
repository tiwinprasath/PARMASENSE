import React, { useState } from 'react';
import { Camera, Save, UserCircle } from 'lucide-react';
import { UserAccount } from '../services/api';

interface ProfileViewProps {
  user: UserAccount;
  onSave: (details: Partial<UserAccount>) => void;
}

export default function ProfileView({ user, onSave }: ProfileViewProps) {
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || '');
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth || '');
  const [employeeId, setEmployeeId] = useState(user.employeeId || '');
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || '');
  const [saved, setSaved] = useState(false);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave({ phone: phone.trim(), address: address.trim(), dateOfBirth, employeeId: employeeId.trim(), photoUrl: photoUrl || undefined });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <section className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-sm max-w-4xl">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:gap-5 border-b border-slate-100 pb-5 mb-6">
        <div className="relative">
          {photoUrl ? <img src={photoUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover border-4 border-teal-100" /> : <div className="h-20 w-20 rounded-full bg-teal-600 text-white flex items-center justify-center"><UserCircle className="h-10 w-10" /></div>}
          <label className="absolute -right-1 -bottom-1 h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center cursor-pointer border-2 border-white" title="Upload optional profile photo">
            <Camera className="h-4 w-4" />
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} className="hidden" />
          </label>
        </div>
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-teal-600">Account profile</span>
          <h1 className="font-display text-2xl font-bold text-slate-900 mt-1 truncate">{user.name}</h1>
          <p className="text-sm text-slate-500 truncate">{user.email} · {user.role}</p>
          <p className="text-[10px] text-slate-400 mt-1">Profile photo is optional. JPG, PNG, or WebP up to 2 MB.</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Phone number" value={phone} onChange={setPhone} type="tel" required />
          <Field label="Date of birth" value={dateOfBirth} onChange={setDateOfBirth} type="date" />
          <Field label="Employee ID" value={employeeId} onChange={setEmployeeId} placeholder={user.role === 'Patient' ? 'Not applicable' : 'Staff ID'} />
          <div className="min-h-[68px]"><label className="block text-[10px] uppercase font-bold text-slate-400">Account status</label><p className="mt-2 text-sm font-bold text-emerald-600">{user.active === false ? 'Inactive' : 'Active'}</p></div>
        </div>
        <div><label className="block text-[10px] uppercase font-bold text-slate-400">Address</label><textarea value={address} onChange={event => setAddress(event.target.value)} rows={3} required className="field mt-1 resize-none" placeholder="Street, city, state" /></div>
        <div className="flex items-center gap-3"><button type="submit" className="primary"><Save className="h-4 w-4" /> Save profile</button>{saved && <span className="text-xs font-bold text-emerald-600">Profile updated</span>}</div>
      </form>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="block min-h-[68px] text-[10px] uppercase font-bold text-slate-400">{label}<input required={required} type={type} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="field mt-1" /></label>;
}
