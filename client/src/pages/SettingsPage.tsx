import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabaseIfEmpty } from '../db/db';
import { useUserRole } from '../hooks/useUserRole';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { syncEngine } from '../services/syncEngine';
import {
  UserCheck,
  Shield,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Trash2,
  Activity,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { role, setRole } = useUserRole();
  const { isOnline, isSimulatedOffline, latencyMs, toggleSimulatedOffline } =
    useNetworkStatus();

  const [isSyncing, setIsSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reportCount = useLiveQuery(() => db.reports.count(), []) || 0;
  const outboxCount = useLiveQuery(() => db.outbox.count(), []) || 0;

  const handleForceSync = async () => {
    setIsSyncing(true);
    setMsg('Initiating force synchronization with server...');
    const result = await syncEngine.syncNow();
    setIsSyncing(false);
    if (result.success) {
      setMsg(`Sync successful: ${result.syncedOutboxCount} pushed, ${result.pulledReportsCount} pulled.`);
    } else {
      setMsg(`Sync notice: ${result.error || 'Server offline, cached locally.'}`);
    }
    setTimeout(() => setMsg(null), 4000);
  };

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

  const handleResetDatabase = async () => {
    if (
      window.confirm(
        'Are you sure you want to reset the local IndexedDB? This re-seeds initial sample reports and wipes the local outbox.'
      )
    ) {
      await db.reports.clear();
      await db.outbox.clear();
      await db.activityLog.clear();
      await seedDatabaseIfEmpty();
      setMsg('Database reset to initial sample seed state.');
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-on-surface">Terminal Settings & Diagnostics</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Hardware configuration, role persona emulation, telemetry sync & local cache retention
        </p>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{msg}</span>
        </div>
      )}

      {/* Role Switcher */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-secondary" />
              <span>Active Tactical Persona</span>
            </h3>
            <p className="text-xs text-on-surface-variant">
              Switch role context between Field Operator and Regional Coordinator
            </p>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-primary text-tertiary-fixed font-bold">
            {role.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole('worker')}
            className={`p-4 rounded-xl border text-left transition-all ${
              role === 'worker'
                ? 'bg-secondary/10 border-secondary ring-2 ring-secondary/20 shadow-xs'
                : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-on-surface">Sarah J.</span>
              <UserCheck className="w-4 h-4 text-secondary" />
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Field Worker</p>
            <p className="text-[11px] font-mono text-secondary mt-1">
              Unit: Hydro Rapid Response Alpha
            </p>
          </button>

          <button
            type="button"
            onClick={() => setRole('coordinator')}
            className={`p-4 rounded-xl border text-left transition-all ${
              role === 'coordinator'
                ? 'bg-secondary/10 border-secondary ring-2 ring-secondary/20 shadow-xs'
                : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container-low'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-on-surface">Ahmed K.</span>
              <Shield className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Regional Coordinator</p>
            <p className="text-[11px] font-mono text-secondary mt-1">
              Unit: Central Field Operations Hub
            </p>
          </button>
        </div>
      </div>

      {/* Offline Mode Simulator & Network Diagnostics */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <Activity className="w-4 h-4 text-secondary" />
            <span>Network Uplink & Offline Simulator</span>
          </h3>
          <p className="text-xs text-on-surface-variant">
            Emulate deep desert or subterranean signal loss without cutting host Wi-Fi
          </p>
        </div>

        <div className="flex items-center justify-between p-4 bg-surface-container-low/60 rounded-xl border border-surface-container">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isSimulatedOffline ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isSimulatedOffline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-sm font-bold text-on-surface block">
                Simulate Zero-Connectivity Offline Mode
              </span>
              <span className="text-xs text-on-surface-variant">
                {isSimulatedOffline
                  ? 'All HTTP sync network traffic is suspended locally.'
                  : 'Normal connectivity mode active.'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSimulatedOffline}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isSimulatedOffline
                ? 'bg-rose-700 text-white hover:bg-rose-800'
                : 'bg-primary text-white hover:bg-primary-container'
            }`}
          >
            {isSimulatedOffline ? 'Disable Simulation' : 'Simulate Offline'}
          </button>
        </div>

        {/* Diagnostic Telemetry Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container">
            <span className="text-on-surface-variant block mb-1">Effective Status</span>
            <span
              className={`font-mono font-bold ${
                isOnline ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container">
            <span className="text-on-surface-variant block mb-1">Ping Latency</span>
            <span className="font-mono font-bold text-on-surface">
              {latencyMs ? `${latencyMs} ms` : '—'}
            </span>
          </div>

          <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container">
            <span className="text-on-surface-variant block mb-1">Outbox Items</span>
            <span className="font-mono font-bold text-amber-700">{outboxCount} queued</span>
          </div>

          <div className="bg-surface-container-low p-3 rounded-xl border border-surface-container">
            <span className="text-on-surface-variant block mb-1">Total Reports</span>
            <span className="font-mono font-bold text-on-surface">{reportCount} records</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-white text-xs font-bold hover:bg-secondary-container transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Force Sync Telemetry</span>
          </button>
        </div>
      </div>

      {/* Local Storage & Cache Management */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-secondary" />
            <span>Data Extraction & Local Storage Engine</span>
          </h3>
          <p className="text-xs text-on-surface-variant">
            Export offline database snapshots or restore clean calibration state
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex items-center justify-between p-3.5 rounded-xl border border-surface-container bg-surface-container-low/40 hover:bg-surface-container-low transition-colors text-xs font-semibold text-on-surface"
          >
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-secondary" />
              <span>Export Full Cache (JSON)</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              .json
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportGeoJSON}
            className="flex items-center justify-between p-3.5 rounded-xl border border-surface-container bg-surface-container-low/40 hover:bg-surface-container-low transition-colors text-xs font-semibold text-on-surface"
          >
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-secondary" />
              <span>Export GIS Coordinates (GeoJSON)</span>
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              .geojson
            </span>
          </button>
        </div>

        <div className="border-t border-surface-container pt-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-700 block">Reset Local Database</span>
            <span className="text-[11px] text-on-surface-variant">
              Clears Dexie cache and reloads default seed records
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetDatabase}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};
