import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useUserRole } from '../hooks/useUserRole';
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
} from 'lucide-react';

interface HeaderProps {
  onNavigateSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigateSettings }) => {
  const { isOnline, isSimulatedOffline, latencyMs } = useNetworkStatus();
  const { user, isCoordinator } = useUserRole();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState<boolean>(false);

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

  return (
    <header className="sticky top-0 z-40 bg-primary text-white border-b border-primary-container shadow-md">
      {/* Top Tactical Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
        {/* Brand & Mission Tag */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-secondary to-secondary-container text-white shadow-inner">
            <Radio className="w-5 h-5 animate-pulse text-tertiary-fixed" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-wider uppercase text-white font-mono">
                Nile<span className="text-tertiary-fixed">Pixel</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-primary-container text-surface-container-high border border-slate-700">
                v2.4-FIELD
              </span>
            </div>
            <p className="text-[11px] text-surface-container-high/70 hidden sm:block">
              Decentralized Offline Field Telemetry
            </p>
          </div>
        </div>

        {/* Center / Right Status Pills */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Network Signal Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
            }`}
            title={
              isSimulatedOffline
                ? 'Offline Mode (Manual Simulation)'
                : isOnline
                ? `Online - Latency ${latencyMs ?? 18}ms`
                : 'Offline - Field Cache Engaged'
            }
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[11px]">ONLINE</span>
                {latencyMs && (
                  <span className="hidden md:inline text-[10px] opacity-75">
                    {latencyMs}ms
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span className="font-mono text-[11px]">
                  {isSimulatedOffline ? 'SIM OFFLINE' : 'OFFLINE'}
                </span>
              </>
            )}
          </div>

          {/* Pending Queue Pill */}
          {pendingCount > 0 ? (
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition-all cursor-pointer"
              title="Click to sync outbox queue with hub"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-400 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span>{pendingCount} QUEUED</span>
            </button>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-surface-container-high bg-primary-container/80 border border-slate-700">
              <CheckCircle2 className="w-3 h-3 text-tertiary-fixed" />
              <span>SYNCED</span>
            </div>
          )}

          {/* User Profile / Role Pill */}
          <button
            onClick={onNavigateSettings}
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-primary-container border border-slate-700 hover:border-secondary transition-colors"
            title={`Active: ${user.name} (${user.role}) - Click for Settings`}
          >
            <div className="w-6 h-6 rounded-full bg-secondary-container text-white flex items-center justify-center text-xs font-bold font-mono">
              {user.name.charAt(0)}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold leading-tight text-white flex items-center gap-1">
                {user.name}
                {isCoordinator ? (
                  <Shield className="w-3 h-3 text-amber-400" />
                ) : (
                  <UserCheck className="w-3 h-3 text-tertiary-fixed" />
                )}
              </div>
              <div className="text-[10px] text-surface-container-high/60 capitalize leading-none">
                {user.role}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Auto-syncing Banner if active or offline notice */}
      {isSyncing && (
        <div className="bg-secondary-container/90 text-white text-xs px-4 py-1 flex items-center justify-center gap-2 border-t border-secondary animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Synchronizing telemetry bundle with NilePixel central servers...</span>
        </div>
      )}

      {syncSuccessToast && (
        <div className="bg-emerald-700 text-white text-xs px-4 py-1 flex items-center justify-center gap-2 border-t border-emerald-500">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Sync complete! All reports and outbox changes updated.</span>
        </div>
      )}
    </header>
  );
};
