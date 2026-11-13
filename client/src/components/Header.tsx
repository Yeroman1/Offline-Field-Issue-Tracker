import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAuth } from '../context/AuthContext';
import { db } from '../db/db';
import { syncEngine } from '../services/syncEngine';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Radio,
  UserCheck,
  Shield,
  CheckCircle2,
  Menu,
  X,
  PlusCircle,
  LayoutDashboard,
  ClipboardList,
  History,
  Settings,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onNavigateSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigateSettings }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline, latencyMs } = useNetworkStatus();
  const { profile, isCoordinator, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const userName = profile?.fullName || profile?.email || 'Field Worker';
  const userRole = profile?.role || 'FIELD_WORKER';

  const handleSettingsClick = () => {
    setMobileMenuOpen(false);
    if (onNavigateSettings) onNavigateSettings();
    else navigate('/settings');
  };

  useEffect(() => {
    const unsub = syncEngine.subscribe((status) => {
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);
    });

    const updateCount = async () => {
      const cnt = await db.outbox.where('status').equals('pending').count();
      setPendingCount(cnt);
    };
    updateCount();
    const interval = setInterval(updateCount, 4000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    const result = await syncEngine.syncNow();
    setIsSyncing(false);
    if (result.success) {
      setSyncSuccessToast(true);
      setTimeout(() => setSyncSuccessToast(false), 3000);
    }
  };

  const navLinks = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'All Reports', path: '/reports', icon: ClipboardList },
    { label: 'My Reports', path: '/my-reports', icon: UserCheck },
    { label: 'Activity', path: '/activity', icon: History },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-primary text-white border-b border-primary-container shadow-md">
      {/* Main Top Banner */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-surface-container-high hover:text-white hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-tertiary-fixed" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => { setMobileMenuOpen(false); navigate('/'); }}
            className="flex items-center gap-2 cursor-pointer group select-none"
            title="Return to Dashboard"
          >
            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-secondary to-secondary-container text-white shadow-inner group-hover:scale-105 transition-transform shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-tertiary-fixed" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black tracking-wider uppercase text-white font-mono group-hover:text-tertiary-fixed transition-colors">
                  Nile<span className="text-tertiary-fixed">Pixel</span>
                </span>
                <span className="hidden lg:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary-container text-surface-container-high border border-slate-700">
                  FIELD
                </span>
              </div>
              <p className="text-[10px] text-surface-container-high/70 hidden xl:block leading-none">
                Offline Field Telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Center: Desktop Navigation Bar (md and above) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs font-semibold" aria-label="Desktop Navigation">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer min-h-[38px] ${
                  active
                    ? 'bg-primary-container text-tertiary-fixed font-bold border border-slate-700 shadow-inner'
                    : 'text-surface-container-high/80 hover:text-white hover:bg-primary-container/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </button>
            );
          })}

          {/* Direct CTA: + New Report */}
          <button
            type="button"
            onClick={() => navigate('/create')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary hover:bg-secondary-container text-white font-bold transition-all shadow-sm ml-1 cursor-pointer min-h-[38px]"
          >
            <PlusCircle className="w-4 h-4 text-tertiary-fixed" />
            <span>New Report</span>
          </button>
        </nav>

        {/* Right: Telemetry Status Pills & User Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Network Signal Pill */}
          <div
            className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
            }`}
            title={isOnline ? `Online - Latency ${latencyMs ?? 18}ms` : 'Offline - Field Cache Engaged'}
            aria-live="polite"
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-[10px] sm:text-[11px] font-bold">ONLINE</span>
                {latencyMs && (
                  <span className="hidden lg:inline text-[10px] opacity-75 font-mono">
                    {latencyMs}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400 shrink-0 animate-pulse" />
                <span className="font-mono text-[10px] sm:text-[11px] font-bold">OFFLINE</span>
              </>
            )}
          </div>

          {/* Pending Outbox Queue Pill */}
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition-all cursor-pointer min-h-[32px]"
              title="Click to sync outbox queue with cloud hub"
              aria-label={`Pending sync items: ${pendingCount}. Click to sync now.`}
            >
              <RefreshCw
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="text-[10px] sm:text-xs font-bold">{pendingCount} QUEUED</span>
            </button>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-surface-container-high bg-primary-container/80 border border-slate-700">
              <CheckCircle2 className="w-3 h-3 text-tertiary-fixed shrink-0" />
              <span className="text-[11px]">SYNCED</span>
            </div>
          )}

          {/* User Profile Pill */}
          <button
            type="button"
            onClick={handleSettingsClick}
            className="flex items-center gap-1.5 pl-1.5 pr-2 sm:pr-3 py-1 rounded-full bg-primary-container border border-slate-700 hover:border-secondary transition-colors cursor-pointer min-h-[36px]"
            title={`Active User: ${userName} (${userRole}) - Open Settings`}
            aria-label={`User profile: ${userName}, role ${userRole}`}
          >
            <div className="w-6 h-6 rounded-full bg-secondary-container text-white flex items-center justify-center text-xs font-bold font-mono shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden lg:block">
              <div className="text-xs font-semibold leading-tight text-white flex items-center gap-1">
                <span className="truncate max-w-[110px]">{userName}</span>
                {isCoordinator ? (
                  <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                ) : (
                  <UserCheck className="w-3 h-3 text-tertiary-fixed shrink-0" />
                )}
              </div>
              <div className="text-[9px] text-surface-container-high/60 capitalize leading-none font-mono">
                {userRole.toLowerCase().replace('_', ' ')}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Auto-syncing Banner */}
      {isSyncing && (
        <div className="bg-secondary-container/90 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 border-t border-secondary animate-pulse" role="status">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Synchronizing telemetry bundle with NilePixel central servers...</span>
        </div>
      )}

      {syncSuccessToast && (
        <div className="bg-emerald-700 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 border-t border-emerald-500" role="status">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Sync complete! All reports and outbox changes updated.</span>
        </div>
      )}

      {/* Mobile Navigation Drawer Overlay (accessible slide-down) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-primary-container/98 border-t border-slate-700 backdrop-blur-md px-4 py-4 space-y-3 shadow-2xl animate-fade-in">
          <div className="text-[11px] font-mono text-tertiary-fixed uppercase tracking-wider font-bold">
            Navigation Menu
          </div>
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              const Icon = link.icon;
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); navigate(link.path); }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                    active
                      ? 'bg-secondary text-white shadow-sm'
                      : 'bg-primary/60 text-surface-container-high hover:bg-primary hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); navigate('/create'); }}
              className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-container text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4 text-tertiary-fixed" />
              <span>Create New Report</span>
            </button>
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); navigate('/settings'); }}
              className="p-2.5 bg-primary/60 hover:bg-primary text-surface-container-high hover:text-white rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); signOut(); }}
              className="p-2.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
