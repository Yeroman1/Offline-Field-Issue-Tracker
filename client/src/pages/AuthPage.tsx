import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import {
  Shield,
  Lock,
  Mail,
  User,
  AlertCircle,
  ArrowRight,
  HardHat,
  CheckCircle2,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('FIELD_WORKER');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (!fullName.trim()) {
          setErrorMsg('Full name is required.');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email.trim(), password, fullName.trim(), role);
        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg('Account created successfully. Check your email if verification is required, or sign in.');
        }
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setErrorMsg(error.message);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center px-3 sm:px-4 py-6 sm:py-12">
      <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant/30 p-4 sm:p-7 shadow-xl">
        {/* Brand Banner with Official NilePixel Logo */}
        <div className="flex flex-col items-center mb-5 sm:mb-7">
          <img
            src="/logo.png"
            alt="NilePixel Offline Field Issue Tracker"
            className="h-16 sm:h-20 w-auto object-contain mb-3 drop-shadow-sm"
          />
          <p className="text-[11px] sm:text-xs text-on-surface-variant font-mono text-center">
            Tactical Offline Field Issue Tracking & Monitoring
          </p>
        </div>

        {/* Error Feedback */}
        {errorMsg && (
          <div className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-xl bg-error/10 border border-error/20 flex items-start space-x-2.5 text-error text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Success Feedback */}
        {successMsg && (
          <div className="mb-4 sm:mb-5 p-3 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
            {successMsg}
          </div>
        )}

        {/* Segmented Auth Mode Switch */}
        <div className="flex rounded-xl bg-surface-container-high p-1 mb-5 border border-outline-variant/30">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[40px] ${
              !isRegister
                ? 'bg-secondary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMsg(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-h-[40px] ${
              isRegister
                ? 'bg-secondary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          {/* Full Name for Registration */}
          {isRegister && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. David Deng"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant/50 text-base sm:text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all min-h-[44px]"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              Work Email <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="technician@nilepixel.org"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant/50 text-base sm:text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all min-h-[44px]"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-outline-variant/50 text-base sm:text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all min-h-[44px]"
              />
            </div>
          </div>

          {/* Responsive Touch-Friendly Role Selector Cards */}
          {isRegister && (
            <div className="pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Operational Role <span className="text-rose-500">*</span>
              </label>
              
              <div
                role="radiogroup"
                aria-label="Operational Role"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                {/* Field Worker Card */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === 'FIELD_WORKER'}
                  onClick={() => setRole('FIELD_WORKER')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[72px] ${
                    role === 'FIELD_WORKER'
                      ? 'border-secondary bg-secondary/10 ring-2 ring-secondary/30 shadow-sm'
                      : 'border-outline-variant/40 bg-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                      <HardHat className={`w-4 h-4 ${role === 'FIELD_WORKER' ? 'text-secondary' : 'text-on-surface-variant'}`} />
                      <span>Field Worker</span>
                    </span>
                    {role === 'FIELD_WORKER' && (
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    Submit reports offline, capture telemetry & sync locally.
                  </p>
                </button>

                {/* Coordinator Card */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === 'COORDINATOR'}
                  onClick={() => setRole('COORDINATOR')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[72px] ${
                    role === 'COORDINATOR'
                      ? 'border-secondary bg-secondary/10 ring-2 ring-secondary/30 shadow-sm'
                      : 'border-outline-variant/40 bg-surface hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                      <Shield className={`w-4 h-4 ${role === 'COORDINATOR' ? 'text-secondary' : 'text-on-surface-variant'}`} />
                      <span>Coordinator</span>
                    </span>
                    {role === 'COORDINATOR' && (
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight">
                    Triage issues, dispatch crews & verify resolved tickets.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-secondary text-white font-bold text-sm rounded-xl hover:bg-secondary/90 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 shadow-lg shadow-secondary/20 disabled:opacity-50 cursor-pointer min-h-[48px] mt-4"
          >
            <span>{loading ? 'Processing...' : isRegister ? 'Register Field Profile' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
