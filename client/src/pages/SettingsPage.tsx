import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  Download,
  Trash2,
  Radio,
  CheckCircle2,
  HardDrive,
  LogOut,
  User,
  Shield,
  Mail,
  Fingerprint,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { profile, user, signOut, isCoordinator } = useAuth();
  const { isOnline, latencyMs } = useNetworkStatus();
  const [msg, setMsg] = useState<string | null>(null);

  const localReportsCount = useLiveQuery(() => db.reports.count()) || 0;
  const localOutboxCount = useLiveQuery(() => db.outbox.count()) || 0;
  const localActivityCount = useLiveQuery(() => db.activityLog.count()) || 0;

  const handleExportJSON = async () => {
    const allReports = await db.reports.toArray();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allReports, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `nilepixel_reports_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
  };

  const handleExportGeoJSON = async () => {
    const allReports = await db.reports.toArray();
    const geoJson = {
      type: 'FeatureCollection',
      features: allReports
        .filter((r) => r.latitude && r.longitude)
        .map((r) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [r.longitude, r.latitude],
          },
          properties: {
            id: r.id,
            reportNumber: r.reportNumber,
            title: r.title,
            category: r.category,
            priority: r.priority,
            status: r.status,
            reporterName: r.reporterName,
            createdAt: r.createdAt,
          },
        })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geoJson, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `nilepixel_field_points_${new Date().toISOString().slice(0, 10)}.geojson`);
    dlAnchorElem.click();
  };

  const handleClearLocalCache = async () => {
    if (
      window.confirm(
        'Are you sure you want to clear local storage? This removes locally cached reports from IndexedDB. Unsynced outbox operations will be cleared.'
      )
    ) {
      await db.reports.clear();
      await db.outbox.clear();
      await db.activityLog.clear();
      setMsg('Local IndexedDB tables cleared.');
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Sign out from NilePixel Field Tracker?')) {
      await signOut();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-on-surface">Terminal Settings & Authentication</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Verified Supabase session, hardware telemetry uplink & local IndexedDB storage management
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Authenticated Supabase Identity Card */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                {profile?.fullName || 'Verified Field User'}
              </h3>
              <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{user?.email}</span>
              </p>
            </div>
          </div>
          <span
            className={`font-mono text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
              isCoordinator
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}
          >
            {isCoordinator ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            <span>{profile?.role || 'FIELD_WORKER'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/30">
            <span className="text-on-surface-variant block mb-1 flex items-center gap-1">
              <Fingerprint className="w-3.5 h-3.5" /> Supabase Auth UUID
            </span>
            <span className="text-on-surface font-semibold select-all break-all">{user?.id}</span>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/30">
            <span className="text-on-surface-variant block mb-1 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5" /> Network Uplink Status
            </span>
            <span className="text-on-surface font-semibold">
              {isOnline ? `Online (${latencyMs ?? 18}ms ping)` : 'Offline (Field Mode)'}
            </span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 bg-error/10 hover:bg-error/20 text-error rounded-xl font-bold text-xs flex items-center gap-2 border border-error/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Session</span>
          </button>
        </div>
      </div>

      {/* Local IndexedDB Diagnostics */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-secondary" />
            <span>Local IndexedDB Persistence (Dexie.js)</span>
          </h3>
          <p className="text-xs text-on-surface-variant">
            Zero-latency browser storage partition for offline continuity
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container">
            <span className="text-lg font-black font-mono text-on-surface">{localReportsCount}</span>
            <span className="block text-[11px] text-on-surface-variant mt-0.5">Cached Reports</span>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container">
            <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
              {localOutboxCount}
            </span>
            <span className="block text-[11px] text-on-surface-variant mt-0.5">Queued Outbox</span>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container">
            <span className="text-lg font-black font-mono text-on-surface">{localActivityCount}</span>
            <span className="block text-[11px] text-on-surface-variant mt-0.5">Audit Events</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Reports JSON</span>
          </button>
          <button
            type="button"
            onClick={handleExportGeoJSON}
            className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export GIS GeoJSON</span>
          </button>
          <button
            type="button"
            onClick={handleClearLocalCache}
            className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local Storage</span>
          </button>
        </div>
      </div>

      {/* Official Branding Footer */}
      <div className="flex flex-col items-center justify-center pt-4 pb-2 text-center opacity-85 hover:opacity-100 transition-opacity">
        <img
          src="/logo.png"
          alt="NilePixel Offline Field Issue Tracker"
          className="h-10 w-auto object-contain mb-1"
        />
        <p className="text-[10px] text-on-surface-variant font-mono">
          NilePixel Offline Field Issue Tracker • v1.0.0 Production
        </p>
      </div>
    </div>
  );
};
