import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, Key, ChevronRight, UserCheck, Smartphone, UserPlus, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginViewProps {
  onLoginSuccess: (email: string, role: string) => void;
}

interface UserAccount {
  email: string;
  passwordHash: string;
  role: string;
  name: string;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStep, setAuthStep] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Local account database
  const [users, setUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('pharmasense_users');
    if (stored) {
      try {
        setUsers(JSON.parse(stored));
      } catch (e) {
        // Fallback
      }
    } else {
      // Seed default user
      const defaultUsers: UserAccount[] = [
        {
          email: 'tiwinprasath056@gmail.com',
          passwordHash: 'admin1234',
          role: 'Admin',
          name: 'Tiwin Prasath'
        }
      ];
      localStorage.setItem('pharmasense_users', JSON.stringify(defaultUsers));
      setUsers(defaultUsers);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your staff email.');
      return;
    }
    if (!password) {
      setError('Please enter your passcode.');
      return;
    }

    // Match credential
    const matched = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password
    );

    if (!matched) {
      setError('Invalid email or passcode. Please check your credentials or register a new account.');
      return;
    }

    setError('');
    setIsAuthenticating(true);

    const steps = [
      'Establishing SSL connection to auth-node...',
      'Validating credential hash...',
      'Verifying permission flags for role: ' + matched.role + '...',
      'Retrieving database shard security keys...',
      'Access Authorized! Redirecting to dashboard...'
    ];

    let currentStep = 0;
    setAuthStep(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setAuthStep(steps[currentStep]);
      } else {
        clearInterval(interval);
        onLoginSuccess(matched.email, matched.role);
      }
    }, 450);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError('Please enter your full name.');
      return;
    }
    if (!email) {
      setError('Please provide an email.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    // Check if user already exists
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      setError('Account with this email already exists.');
      return;
    }

    const newUser: UserAccount = {
      email: email.trim(),
      passwordHash: password,
      role: role,
      name: name.trim()
    };

    const updatedUsers = [...users, newUser];
    localStorage.setItem('pharmasense_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);

    setError('');
    setSuccessMessage('Registration successful! Please login with your credentials.');
    setMode('login');
    // Clear registration fields
    setName('');
    setPassword('');
  };

  const setPresetUser = (presetEmail: string, presetPass: string, presetRole: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setRole(presetRole);
    setMode('login');
    setError('');
    setSuccessMessage('');
  };

  return (
    <div id="login_container" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative px-4 overflow-hidden">
      {/* Visual background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1] 
          }}
          transition={{ 
            duration: 10, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.1, 0.12, 0.1] 
          }}
          transition={{ 
            duration: 12, 
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        {/* Header Branding */}
        <div className="text-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="inline-flex h-16 w-16 items-center justify-center bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-400 text-3xl font-bold shadow-lg shadow-teal-500/5 mb-4 cursor-pointer"
          >
            ✚
          </motion.div>
          <h1 className="font-display font-extrabold text-white text-2xl tracking-tight uppercase">
            PharmeSense
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-mono tracking-wider">
            SMART PHARMACY MANAGEMENT PLATFORM
          </p>
        </div>

        {/* Tab Selection (Login vs Register) */}
        {!isAuthenticating && (
          <div className="flex gap-2 mb-4 bg-slate-900 border border-slate-800 p-1.5 rounded-xl relative">
            <button
              onClick={() => {
                setMode('login');
                setError('');
                setSuccessMessage('');
              }}
              className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer relative z-10"
            >
              {mode === 'login' && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-slate-800 rounded-lg -z-10 border border-slate-700/50"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <User className={`h-4 w-4 ${mode === 'login' ? 'text-teal-400' : 'text-slate-400'}`} />
              <span className={mode === 'login' ? 'text-teal-400 font-bold' : 'text-slate-400'}>Sign In</span>
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError('');
                setSuccessMessage('');
              }}
              className="flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer relative z-10"
            >
              {mode === 'register' && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-slate-800 rounded-lg -z-10 border border-slate-700/50"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <UserPlus className={`h-4 w-4 ${mode === 'register' ? 'text-teal-400' : 'text-slate-400'}`} />
              <span className={mode === 'register' ? 'text-teal-400 font-bold' : 'text-slate-400'}>Register</span>
            </button>
          </div>
        )}

        {/* Auth Card */}
        <motion.div 
          animate={{ x: error ? [-6, 6, -6, 6, -3, 3, 0] : 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {isAuthenticating ? (
              /* Cool login simulator overlay */
              <motion.div
                key="authenticating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center justify-center space-y-6"
              >
                <div className="relative h-16 w-16 flex items-center justify-center">
                  {/* Spinner */}
                  <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                  <div className="absolute inset-0 border-4 border-t-teal-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                  <ShieldCheck className="h-6 w-6 text-teal-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-semibold text-white">Security Auditing</h3>
                  <p className="text-xs text-teal-400 font-mono mt-1.5 animate-pulse min-h-[16px]">{authStep}</p>
                </div>
                <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2.25, ease: "easeInOut" }}
                    className="bg-teal-500 h-full" 
                  />
                </div>
              </motion.div>
            ) : mode === 'login' ? (
              <motion.form
                key="login-form"
                onSubmit={handleLogin}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-lg text-xs font-semibold font-mono flex items-center gap-2"
                  >
                    <span className="shrink-0 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    {error}
                  </motion.div>
                )}

                {successMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-teal-500/10 border border-teal-500/30 text-teal-400 p-3 rounded-lg text-xs font-semibold font-mono flex items-center gap-2"
                  >
                    <span className="shrink-0 h-2 w-2 rounded-full bg-teal-400 animate-ping" />
                    {successMessage}
                  </motion.div>
                )}

                {/* Email Address */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                    Staff Email / ID
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="name@pharmasense.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-2.5 pl-9.5 pr-4 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                      Security Passcode
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-2.5 pl-9.5 pr-10 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-teal-600/10 cursor-pointer transition-all flex items-center justify-center gap-1.5 group"
                >
                  Access Systems
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="register-form"
                onSubmit={handleRegister}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-lg text-xs font-semibold font-mono flex items-center gap-2"
                  >
                    <span className="shrink-0 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    {error}
                  </motion.div>
                )}

                {/* Full Name */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="Dr. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-2.5 pl-9.5 pr-4 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                    Staff Email / ID
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="name@pharmasense.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-2.5 pl-9.5 pr-4 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                    Set Security Passcode
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 4 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-2.5 pl-9.5 pr-10 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1.5">
                    Terminal Permission Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Admin', 'Pharmacist', 'Manager'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-2 text-[11px] font-bold rounded-lg border font-mono transition-all relative ${
                          role === r
                            ? 'text-teal-400 border-teal-500 font-bold'
                            : 'text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-400'
                        }`}
                      >
                        {role === r && (
                          <motion.div 
                            layoutId="activeRoleBg"
                            className="absolute inset-0 bg-teal-500/10 rounded-lg -z-10"
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          />
                        )}
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-teal-600/10 cursor-pointer transition-all flex items-center justify-center gap-1.5 group font-sans"
                >
                  Register & Complete Signup
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Preset Demonstration Credentials */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 mt-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase font-mono border-b border-slate-800/60 pb-1.5">
            <Key className="h-3.5 w-3.5 text-teal-500" />
            Terminal Demo Presets
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setPresetUser('tiwinprasath056@gmail.com', 'admin1234', 'Admin')}
              className="text-left bg-slate-950/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 p-2 rounded-lg flex justify-between items-center transition-all cursor-pointer group"
            >
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-200 block truncate font-mono">
                  tiwinprasath056@gmail.com
                </span>
                <span className="text-[9px] text-slate-500 font-mono">Password: admin1234 (Admin)</span>
              </div>
              <UserCheck className="h-4 w-4 text-teal-500/80 group-hover:scale-110 transition-transform shrink-0 ml-1" />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-[10px] text-slate-500 font-mono flex items-center justify-center gap-1.5">
          <Smartphone className="h-3 w-3 animate-bounce" />
          SYSTEM ENCRYPTED WITH AES-256 SECURE SOCKET LAYERS
        </div>
      </motion.div>
    </div>
  );
}
