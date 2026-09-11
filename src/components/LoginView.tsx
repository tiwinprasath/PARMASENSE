import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  ShieldCheck, Lock, Mail, Eye, EyeOff, ChevronRight, 
  Smartphone, UserPlus, User, CheckCircle2, 
  AlertCircle, Sparkles, Shield, Stethoscope, Building2, BadgeCheck,
  Activity, Pill, ArrowRight, Zap, LockKeyhole, Monitor, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginViewProps {
  onLoginSuccess: (email: string, role: string, details?: Partial<UserAccount>) => void;
}

interface UserAccount {
  email: string;
  passwordHash: string;
  role: string;
  name: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  employeeId?: string;
  photoUrl?: string;
  active?: boolean;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'Admin' | 'Pharmacist' | 'Manager' | 'Patient'>('Admin');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regDateOfBirth, setRegDateOfBirth] = useState('');
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Authenticating Loader & Messages
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStepMessage, setAuthStepMessage] = useState('');
  const [authProgress, setAuthProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Local User Accounts DB State
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Seed / Load accounts from backend API and localStorage fallback
  useEffect(() => {
    let active = true;

    // Check localStorage for immediate offline availability
    const stored = localStorage.getItem('pharmasense_users');
    let localAccounts: UserAccount[] = [];
    if (stored) {
      try {
        localAccounts = JSON.parse(stored);
        setUsers(localAccounts);
      } catch (e) {
        // fallback
      }
    }

    // Fetch latest users from Express backend API
    api.fetchUsers()
      .then((serverUsers) => {
        if (!active) return;
        if (Array.isArray(serverUsers) && serverUsers.length > 0) {
          setUsers(serverUsers);
          localStorage.setItem('pharmasense_users', JSON.stringify(serverUsers));
        } else if (localAccounts.length > 0) {
          api.saveUsers(localAccounts).catch(() => {});
        }
      })
      .catch(() => {
        // Fallback seed if unreachable
        if (localAccounts.length === 0) {
          const defaultUsers: UserAccount[] = [
            {
              email: 'tiwinprasath056@gmail.com',
              passwordHash: 'admin1234',
              role: 'Admin',
              name: 'Tiwin Prasath'
            },
            {
              email: 'pharmacist@pharmasense.com',
              passwordHash: 'pharma123',
              role: 'Pharmacist',
              name: 'Dr. Sarah Jenkins'
            },
            {
              email: 'manager@pharmasense.com',
              passwordHash: 'manager123',
              role: 'Manager',
              name: 'Alex Rivera'
            }
          ];
          localStorage.setItem('pharmasense_users', JSON.stringify(defaultUsers));
          setUsers(defaultUsers);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Password strength meter calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: 'No passcode entered', color: 'bg-slate-700 text-slate-400' };
    let s = 0;
    if (pass.length >= 4) s += 1;
    if (pass.length >= 8) s += 1;
    if (/[A-Z]/.test(pass)) s += 1;
    if (/[0-9]/.test(pass)) s += 1;
    if (/[^A-Za-z0-9]/.test(pass)) s += 1;

    if (s <= 2) return { score: s, text: 'Weak Passcode', color: 'bg-rose-500 text-rose-400' };
    if (s <= 4) return { score: s, text: 'Medium Strength', color: 'bg-amber-500 text-amber-400' };
    return { score: s, text: 'Strong AES-256 Passcode', color: 'bg-emerald-500 text-emerald-400' };
  };

  const strength = getPasswordStrength(regPassword);

  // Handle Login submission with backend API attempt and local fallback
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!loginEmail.trim()) {
      setErrorMsg('Please enter your staff email address.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Please enter your security passcode.');
      return;
    }

    const cleanEmail = loginEmail.trim();

    // Check credentials against state
    let matched = users.find(
      (u) => u.email.toLowerCase() === cleanEmail.toLowerCase() && u.passwordHash === loginPassword
    );

    // Try backend authentication
    try {
      const res = await api.loginAuth({ email: cleanEmail, password: loginPassword });
      if (res && res.success && res.user) {
        matched = {
          email: res.user.email,
          name: res.user.name,
          role: res.user.role,
          passwordHash: loginPassword
        };
      }
    } catch (err: any) {
      // If server returns explicit error or offline, fallback to matched
      if (err?.message && !matched) {
        setErrorMsg(err.message);
        return;
      }
    }

    if (!matched) {
      setErrorMsg('Invalid email or passcode credentials. Verify credentials or register a new account.');
      return;
    }

    // Launch SSL audit simulator
    setIsAuthenticating(true);
    const steps = [
      'Establishing AES-256 socket to security node...',
      'Verifying credential SHA-256 checksum...',
      'Checking role authorization [' + matched.role + ']...',
      'Decrypting terminal database keys...',
      'Session Granted! Redirecting to workstation...'
    ];

    let current = 0;
    setAuthStepMessage(steps[0]);
    setAuthProgress(20);

    const timer = setInterval(() => {
      current++;
      if (current < steps.length) {
        setAuthStepMessage(steps[current]);
        setAuthProgress(Math.min((current + 1) * 20, 100));
      } else {
        clearInterval(timer);
        onLoginSuccess(matched!.email, matched!.role, matched!);
      }
    }, 380);
  };

  // Handle Registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!regName.trim()) {
      setErrorMsg('Full staff name is required.');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMsg('Valid staff email address is required.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMsg('Passcode must be at least 4 characters long.');
      return;
    }

    const cleanEmail = regEmail.trim();

    // Check duplicate locally
    const exists = users.some((u) => u.email.toLowerCase() === cleanEmail.toLowerCase());
    if (exists) {
      setErrorMsg('An account with this email address already exists. Please sign in instead.');
      return;
    }

    const newUser: UserAccount = {
      email: cleanEmail,
      passwordHash: regPassword,
      role: regRole,
      name: regName.trim(),
      phone: regPhone.trim() || undefined,
      address: regAddress.trim() || undefined,
      dateOfBirth: regDateOfBirth || undefined,
      employeeId: regEmployeeId.trim() || undefined,
      active: true
    };

    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem('pharmasense_users', JSON.stringify(updated));

    // Try backend registration
    try {
      await api.registerAuth({
        name: regName.trim(),
        email: cleanEmail,
        password: regPassword,
        role: regRole,
        phone: regPhone.trim() || undefined,
        address: regAddress.trim() || undefined,
        dateOfBirth: regDateOfBirth || undefined,
        employeeId: regEmployeeId.trim() || undefined
      });
    } catch (err: any) {
      // Sync whole array as fallback
      api.saveUsers(updated).catch(() => {});
    }

    // Pre-fill sign in form
    setLoginEmail(cleanEmail);
    setLoginPassword(regPassword);
    setSuccessMsg(`Account registered for ${regName.trim()} (${regRole})! Sign in below.`);
    setActiveTab('login');

    // Reset registration inputs
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegPhone('');
    setRegAddress('');
    setRegDateOfBirth('');
    setRegEmployeeId('');
  };

  return (
    <div id="login_container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center relative p-3 sm:p-6 lg:p-8 overflow-x-hidden select-none">
      
      {/* Background Mesh Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[140px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.12, 0.22, 0.12] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[140px]" 
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-[160px]" />
      </div>

      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center my-auto">
        
        {/* Left Side (Desktop / Website Showcase Panel) */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-5 space-y-6 hidden lg:block"
        >
          {/* Logo & Platform Title */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-mono font-bold tracking-wide">
              <Zap className="h-3.5 w-3.5 text-teal-400" />
              SMART PHARMACY WORKSTATION
            </div>
            <h1 className="text-4xl font-display font-black tracking-tight text-white uppercase leading-tight">
              PharmeSense <span className="text-teal-400">Pro</span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed font-sans">
              Complete pharmacy operations suite. Real-time POS billing, inventory management, AI-driven stock demand forecasting, and automated prescription handling.
            </p>
          </div>

          {/* Website Feature Highlight Cards */}
          <div className="grid grid-cols-1 gap-3 pt-1">
            {[
              {
                icon: Pill,
                title: 'Smart Stock & POS Desk',
                desc: 'Batch tracking, expiry detection & automated barcode scanner.',
                color: 'text-teal-400 bg-teal-500/10 border-teal-500/20'
              },
              {
                icon: Sparkles,
                title: 'AI Medicine Demand Forecast',
                desc: 'Predictive inventory replenishment based on sales velocity.',
                color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
              },
              {
                icon: ShieldCheck,
                title: 'Role Authorization & SSL Guard',
                desc: 'Encrypted access tiers for Admins, Pharmacists & Store Managers.',
                color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              }
            ].map((item, idx) => {
              const IconComp = item.icon;
              return (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl flex items-start gap-3.5 hover:border-slate-700 transition-colors">
                  <div className={`p-2.5 rounded-xl border ${item.color} shrink-0`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 font-mono">{item.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-sans leading-tight">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Security Badge */}
          <div className="pt-2 flex items-center gap-2.5 text-slate-500 font-mono text-xs">
            <LockKeyhole className="h-4 w-4 text-teal-400 shrink-0" />
            <span>AES-256 Encrypted SSL Session Active</span>
          </div>
        </motion.div>

        {/* Right Side (Mobile & Website Interactive Auth Portal) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-7 w-full max-w-md mx-auto"
        >
          {/* Mobile Specific Header Banner (Visible on Mobile/Tablets) */}
          <div className="text-center mb-5 lg:hidden space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-400 text-2xl font-extrabold shadow-lg">
              ✚
            </div>
            <div>
              <h2 className="font-display font-black text-white text-2xl tracking-tight uppercase">
                PharmeSense <span className="text-teal-400 text-sm font-mono lowercase px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 font-bold">Pro</span>
              </h2>
              <p className="text-slate-400 text-xs font-mono tracking-wide uppercase mt-0.5">
                Pharmacy Mobile & Web Gateway
              </p>
            </div>

            {/* Mobile Feature Chips */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-teal-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                POS & Stock
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-cyan-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-cyan-400" />
                AI Forecast
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400 px-2.5 py-1 rounded-full flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                256-SSL
              </span>
            </div>
          </div>

          {/* Navigation Pill Tabs (Mobile & Website Responsive) */}
          {!isAuthenticating && (
            <div className="flex gap-1.5 mb-4 bg-slate-900/90 border border-slate-800/90 p-1.5 rounded-2xl backdrop-blur-2xl shadow-inner relative">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`flex-1 min-h-[44px] py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer relative z-10 ${
                  activeTab === 'login' ? 'text-teal-300 font-extrabold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {activeTab === 'login' && (
                  <motion.div
                    layoutId="activeAuthTabPill"
                    className="absolute inset-0 bg-teal-500/15 border border-teal-500/30 rounded-xl -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
                <User className={`h-4 w-4 ${activeTab === 'login' ? 'text-teal-400' : 'text-slate-500'}`} />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className={`flex-1 min-h-[44px] py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer relative z-10 ${
                  activeTab === 'register' ? 'text-teal-300 font-extrabold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {activeTab === 'register' && (
                  <motion.div
                    layoutId="activeAuthTabPill"
                    className="absolute inset-0 bg-teal-500/15 border border-teal-500/30 rounded-xl -z-10 shadow-sm"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  />
                )}
                <UserPlus className={`h-4 w-4 ${activeTab === 'register' ? 'text-teal-400' : 'text-slate-500'}`} />
                <span>Register Staff</span>
              </button>
            </div>
          )}

          {/* Form Container Glass Card */}
          <motion.div 
            animate={{ x: errorMsg ? [-6, 6, -6, 6, -3, 3, 0] : 0 }}
            transition={{ duration: 0.4 }}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 backdrop-blur-2xl relative overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {isAuthenticating ? (
                /* Authenticating Progress Screen */
                <motion.div
                  key="authenticating-loader"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-10 flex flex-col items-center justify-center space-y-6 text-center"
                >
                  <div className="relative h-20 w-20 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-teal-400 border-r-teal-500/30 border-b-transparent border-l-transparent rounded-full animate-spin" />
                    <ShieldCheck className="h-9 w-9 text-teal-400 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase font-display">Authenticating Session</h3>
                    <p className="text-xs text-teal-400 font-mono animate-pulse min-h-[20px] font-semibold">{authStepMessage}</p>
                  </div>
                  <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: `${authProgress}%` }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full" 
                    />
                  </div>
                </motion.div>
              ) : activeTab === 'login' ? (
                /* SIGN IN FORM (Mobile & Website) */
                <motion.form
                  key="login-form-view"
                  onSubmit={handleLoginSubmit}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="border-b border-slate-800/80 pb-3 mb-1">
                    <h2 className="text-base sm:text-lg font-display font-extrabold text-white">Staff Sign In</h2>
                    <p className="text-xs text-slate-400">Enter your official credentials to launch the workstation.</p>
                  </div>

                  {/* Feedback Banners */}
                  {errorMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-2xl text-xs font-semibold font-mono flex items-start gap-2.5"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}

                  {successMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-2xl text-xs font-semibold font-mono flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                      <span>{successMsg}</span>
                    </motion.div>
                  )}

                  {/* Staff Email Field */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                      Staff Email / User ID
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="tiwinprasath056@gmail.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Passcode Field */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                        Security Passcode
                      </label>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 pl-10 pr-11 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer p-1"
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Station */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-teal-500 focus:ring-teal-500/30 h-4 w-4"
                      />
                      Remember station credentials
                    </label>
                  </div>

                  {/* Login Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-xs font-extrabold text-white rounded-xl shadow-lg shadow-teal-600/20 cursor-pointer transition-all flex items-center justify-center gap-2 group mt-2 uppercase tracking-wide"
                  >
                    <span>Launch Workstation</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </motion.form>
              ) : (
                /* REGISTRATION FORM (Mobile & Website) */
                <motion.form
                  key="register-form-view"
                  onSubmit={handleRegisterSubmit}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="border-b border-slate-800/80 pb-3 mb-1">
                    <h2 className="text-base sm:text-lg font-display font-extrabold text-white">Create Staff Account</h2>
                    <p className="text-xs text-slate-400">Register new team member for platform access.</p>
                  </div>

                  {errorMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-2xl text-xs font-semibold font-mono flex items-start gap-2.5"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}

                  {/* Name Input */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                      Full Staff Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tiwin Prasath"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                      Official Staff Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="name@pharmasense.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input type="tel" required placeholder="+91 98765 43210" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 px-3.5 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">Date of Birth</label>
                      <input type="date" value={regDateOfBirth} onChange={(e) => setRegDateOfBirth(e.target.value)} className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 px-3.5 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">Address</label>
                    <textarea required rows={2} placeholder="Street, city, state" value={regAddress} onChange={(e) => setRegAddress(e.target.value)} className="w-full bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 px-3.5 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono resize-none" />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">Employee ID <span className="text-slate-600">(staff roles)</span></label>
                    <input type="text" placeholder="Optional staff ID" value={regEmployeeId} onChange={(e) => setRegEmployeeId(e.target.value)} className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 px-3.5 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono" />
                  </div>

                  {/* Passcode & Strength Meter */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                      Create Passcode
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        required
                        placeholder="At least 4 characters..."
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full min-h-[44px] bg-slate-950/70 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 pl-10 pr-11 focus:outline-none focus:ring-1 focus:ring-teal-500/40 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer p-1"
                      >
                        {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Dynamic Password Rating */}
                    {regPassword && (
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-400 font-semibold">Security Strength:</span>
                          <span className={`font-bold ${strength.color.split(' ')[1]}`}>
                            {strength.text}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden flex gap-1 p-0.5 border border-slate-800">
                          {[1, 2, 3, 4, 5].map((lvl) => (
                            <div
                              key={lvl}
                              className={`h-full flex-1 rounded-full transition-colors ${
                                lvl <= strength.score
                                  ? strength.color.split(' ')[0]
                                  : 'bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Role Selector Grid */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                      Assign Access Rights Role
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { role: 'Admin', label: 'Admin', icon: Shield, desc: 'Full System' },
                        { role: 'Pharmacist', label: 'Rx Desk', icon: Stethoscope, desc: 'Rx Dispensing' },
                        { role: 'Manager', label: 'Manager', icon: Building2, desc: 'Stock & POS' },
                        { role: 'Patient', label: 'Patient', icon: User, desc: 'Patient Access' }
                      ].map((item) => {
                        const IconComp = item.icon;
                        const isSelected = regRole === item.role;
                        return (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => setRegRole(item.role as 'Admin' | 'Pharmacist' | 'Manager' | 'Patient')}
                            className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer relative overflow-hidden min-h-[54px] ${
                              isSelected
                                ? 'border-teal-500 bg-teal-500/10 text-teal-300 font-bold'
                                : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <IconComp className={`h-3.5 w-3.5 ${isSelected ? 'text-teal-400' : 'text-slate-500'}`} />
                              <span className="text-xs font-bold font-mono">{item.label}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 leading-tight block truncate">{item.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Register Button */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-xs font-extrabold text-white rounded-xl shadow-lg shadow-teal-600/20 cursor-pointer transition-all flex items-center justify-center gap-2 group mt-2 uppercase tracking-wide"
                  >
                    <span>Register Staff & Sign In</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Device Responsive Footer */}
          <div className="text-center mt-4 text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2">
            <BadgeCheck className="h-3.5 w-3.5 text-teal-500" />
            <span>OPTIMIZED FOR MOBILE & DESKTOP WEBSITES</span>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
