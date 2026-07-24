import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, LogOut, ArrowRight, ShieldAlert } from 'lucide-react';

interface LockScreenProps {
  userEmail: string;
  onUnlock: () => void;
  onLogout: () => void;
}

interface UserAccount {
  email: string;
  passwordHash: string;
  role: string;
  name: string;
}

export default function LockScreen({ userEmail, onUnlock, onLogout }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Fetch accounts to validate password
    let correctPassword = 'admin1234'; // Default fallback
    const stored = localStorage.getItem('pharmasense_users');
    if (stored) {
      try {
        const users: UserAccount[] = JSON.parse(stored);
        const matched = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
        if (matched) {
          correctPassword = matched.passwordHash;
        }
      } catch (err) {
        // use fallback
      }
    }

    if (password === correctPassword) {
      setIsUnlocking(true);
      // Trigger unlock after a small delay for animation satisfaction
      setTimeout(() => {
        onUnlock();
      }, 400);
    } else {
      setError('Incorrect security passcode. Access Denied.');
      // Shaking feedback animation
      setPassword('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-slate-950/90 select-none"
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[25%] left-[25%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[25%] right-[25%] w-[40%] h-[40%] bg-rose-500/5 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: -20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm mx-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center"
      >
        {/* Animated Security Shield Icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            animate={isUnlocking ? {
              scale: [1, 1.2, 0.9, 1],
              rotate: [0, 10, -10, 0],
            } : {
              y: [0, -4, 0],
            }}
            transition={isUnlocking ? {
              duration: 0.4,
            } : {
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={`h-16 w-16 rounded-2xl flex items-center justify-center border transition-colors ${
              isUnlocking
                ? 'bg-teal-500/10 border-teal-500 text-teal-400'
                : error
                ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                : 'bg-teal-500/10 border-teal-500/20 text-teal-400'
            }`}
          >
            {isUnlocking ? (
              <Unlock className="h-7 w-7" />
            ) : (
              <Lock className="h-7 w-7" />
            )}
          </motion.div>
        </div>

        {/* Locked Status Header */}
        <h2 className="font-display font-black text-white text-lg tracking-tight uppercase">
          Terminal Locked
        </h2>
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-1 block">
          Auto-Secured due to operator navigation
        </p>

        {/* User Identity Info */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 my-5 flex items-center gap-3 text-left">
          <div className="h-9 w-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center font-display font-extrabold text-teal-400">
            {userEmail.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Active Session</span>
            <span className="text-xs font-bold text-slate-200 block truncate font-mono">{userEmail}</span>
          </div>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-2.5 rounded-xl text-[11px] font-semibold font-mono flex items-center gap-2 justify-center"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <input
              type="password"
              required
              autoFocus
              placeholder="Enter passcode to unlock..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-teal-500 text-xs text-white rounded-xl py-3 pl-4 pr-11 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition-all font-mono text-center tracking-widest placeholder:tracking-normal placeholder:text-slate-600"
            />
            <button
              type="submit"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 bg-teal-600 hover:bg-teal-500 text-white rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-95"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="pt-2 flex justify-center border-t border-slate-800/60 mt-4">
            <button
              type="button"
              onClick={onLogout}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-400 font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Switch Account / Sign Out
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
