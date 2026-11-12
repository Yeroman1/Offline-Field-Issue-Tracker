import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ReportStatus, ReportPriority } from '../types';
import { StatusBadge, PriorityBadge, SyncBadge, CategoryIcon } from '../components/Badge';
import { syncEngine } from '../services/syncEngine';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  RefreshCw,
  PlusCircle,
  Clock,
  Radio,
  CheckCircle2,
  XCircle,
  Database,
  MapPin,
  ChevronRight,
  ShieldCheck,
  AlertOctagon,
  ArrowUpRight,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigateCreate: () => void;
  onNavigateAll: () => void;
  onSelectReport: (reportId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateCreate,
  onNavigateAll,
  onSelectReport,
}) => {
  const { isOnline, isSimulatedOffline } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Live queries from Dexie
  const allReports = useLiveQuery(() => db.reports.toArray(), []) || [];
  const pendingOutboxCount = useLiveQuery(
    () => db.outbox.where('status').equals('pending').count(),
    []
  ) || 0;

  const lastSyncTime = syncEngine.getLastSyncTime();

  // Metrics computation
  const totalCount = allReports.length;
  const statusCounts: Record<ReportStatus, number> = {
    draft: 0,
    submitted: 0,
    assigned: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0,
  };

  const priorityCounts: Record<ReportPriority, number> = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };

  const categoryCounts: Record<string, number> = {};

  allReports.forEach((r) => {
    if (statusCounts[r.status] !== undefined) statusCounts[r.status]++;
    if (priorityCounts[r.priority] !== undefined) priorityCounts[r.priority]++;
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  });

  // Recent reports (sorted by updatedAt or createdAt desc)
  const recentReports = [...allReports]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncStatusMsg('Pushing local telemetry batch...');
    const result = await syncEngine.syncNow();
    setIsSyncing(false);
    if (result.success) {
      setSyncStatusMsg(`Synchronized ${result.syncedOutboxCount} pushed, ${result.pulledReportsCount} pulled.`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } else {
      setSyncStatusMsg(`Sync note: ${result.error || 'Server unreachable, remaining in offline cache.'}`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  const formatTimeAgo = (iso?: string | null) => {
    if (!iso) return 'Never';
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      {/* Offline Sync Health Card */}
      <div className="bg-gradient-to-r from-primary via-primary-container to-secondary/40 text-white rounded-2xl p-5 shadow-lg border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-tertiary-fixed/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-tertiary-fixed font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                Local Telemetry Cache
              </span>
              <span className="text-xs text-surface-container-high/60">•</span>
              <span className="text-xs text-surface-container-high/80 font-mono">
                IndexedDB / Dexie Engine
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {totalCount} Field Records Cached Locally
            </h2>
            <p className="text-xs text-surface-container-high/70 mt-1 flex items-center gap-3">
              <span>Last Sync: <strong className="text-white">{formatTimeAgo(lastSyncTime)}</strong></span>
              <span>•</span>
              <span>
                Status:{' '}
                <strong className={isOnline ? 'text-emerald-300' : 'text-amber-300'}>
                  {isSimulatedOffline
                    ? 'Simulated Offline'
                    : isOnline
                    ? 'Connected (Cloud)'
                    : 'Field Offline Mode'}
                </strong>
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md ${
                isOnline
                  ? 'bg-secondary text-white hover:bg-secondary-container active:scale-95'
                  : 'bg-primary-container text-surface-container-high border border-slate-600 hover:border-slate-500'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-tertiary-fixed' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {syncStatusMsg && (
          <div className="mt-3 pt-3 border-t border-slate-700/60 text-xs font-mono text-tertiary-fixed flex items-center gap-2 animate-fade-in">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{syncStatusMsg}</span>
          </div>
        )}
      </div>

      {/* Quick Launcher Card */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface-container-low text-secondary flex items-center justify-center shrink-0 border border-surface-container">
            <AlertOctagon className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-on-surface">
              Log Real-Time Field Incident
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Instant offline capture with automatic GPS coordinate binding & local image caching.
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateCreate}
          className="inline-flex items-center justify-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-secondary-container transition-colors shadow-sm shrink-0"
        >
          <PlusCircle className="w-4 h-4 text-tertiary-fixed" />
          <span>Report New Field Issue</span>
        </button>
      </div>

      {/* Bento Telemetry Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending Sync */}
        <div className="bg-surface-container-lowest border border-surface-container-high p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>Pending Sync</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {pendingOutboxCount}
            </span>
            <span className="text-[11px] text-amber-700 font-medium">In Outbox</span>
          </div>
          <div className="mt-2 text-[11px] text-on-surface-variant truncate">
            Queued for cloud uplink
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-surface-container-lowest border border-surface-container-high p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>In Progress</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-secondary flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {statusCounts.in_progress}
            </span>
            <span className="text-[11px] text-secondary font-medium">Active Crews</span>
          </div>
          <div className="mt-2 text-[11px] text-on-surface-variant truncate">
            Teams on site
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-surface-container-lowest border border-surface-container-high p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>Resolved</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {statusCounts.resolved}
            </span>
            <span className="text-[11px] text-emerald-700 font-medium">Completed</span>
          </div>
          <div className="mt-2 text-[11px] text-on-surface-variant truncate">
            Signed off & verified
          </div>
        </div>

        {/* Declined */}
        <div className="bg-surface-container-lowest border border-surface-container-high p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant">
            <span>Declined / Closed</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-on-surface">
              {statusCounts.rejected}
            </span>
            <span className="text-[11px] text-rose-700 font-medium">Duplicate/Invalid</span>
          </div>
          <div className="mt-2 text-[11px] text-on-surface-variant truncate">
            Reviewed by coordinators
          </div>
        </div>
      </div>

      {/* Priority Strip & Category Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Multi-Segmented Priority Strip */}
        <div className="bg-surface-container-lowest border border-surface-container-high p-5 rounded-2xl shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center justify-between">
            <span>Urgency Matrix Distribution</span>
            <span className="font-mono text-[11px] text-on-surface-variant">
              {totalCount} Total Issues
            </span>
          </h4>

          {/* Progress bar visual strip */}
          <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden flex">
            {totalCount > 0 ? (
              <>
                <div
                  style={{ width: `${(priorityCounts.Critical / totalCount) * 100}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Critical: ${priorityCounts.Critical}`}
                />
                <div
                  style={{ width: `${(priorityCounts.High / totalCount) * 100}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`High: ${priorityCounts.High}`}
                />
                <div
                  style={{ width: `${(priorityCounts.Medium / totalCount) * 100}%` }}
                  className="bg-blue-500 h-full transition-all"
                  title={`Medium: ${priorityCounts.Medium}`}
                />
                <div
                  style={{ width: `${(priorityCounts.Low / totalCount) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Low: ${priorityCounts.Low}`}
                />
              </>
            ) : (
              <div className="w-full bg-surface-container" />
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <div className="p-2 rounded-xl bg-rose-50/60 border border-rose-100">
              <span className="text-[11px] font-semibold text-rose-800 block">Critical</span>
              <span className="font-mono font-bold text-sm text-rose-900">{priorityCounts.Critical}</span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100">
              <span className="text-[11px] font-semibold text-amber-800 block">High</span>
              <span className="font-mono font-bold text-sm text-amber-900">{priorityCounts.High}</span>
            </div>
            <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100">
              <span className="text-[11px] font-semibold text-blue-800 block">Medium</span>
              <span className="font-mono font-bold text-sm text-blue-900">{priorityCounts.Medium}</span>
            </div>
            <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[11px] font-semibold text-emerald-800 block">Low</span>
              <span className="font-mono font-bold text-sm text-emerald-900">{priorityCounts.Low}</span>
            </div>
          </div>
        </div>

        {/* Sector / Category Breakdown */}
        <div className="bg-surface-container-lowest border border-surface-container-high p-5 rounded-2xl shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
            Sector Incident Allocation
          </h4>
          <div className="space-y-2.5">
            {['Water', 'Equipment', 'Infrastructure', 'Safety', 'Maintenance'].map((cat) => {
              const count = categoryCounts[cat] || 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-on-surface">
                      <CategoryIcon category={cat as any} className="w-3.5 h-3.5" />
                      {cat}
                    </span>
                    <span className="font-mono text-on-surface-variant text-[11px]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className="bg-secondary h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Field Reports Feed */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-on-surface">
              Recent Field Telemetry Feed
            </h3>
            <p className="text-xs text-on-surface-variant">
              Live updates recorded in local terminal cache
            </p>
          </div>
          <button
            onClick={onNavigateAll}
            className="text-xs font-medium text-secondary hover:text-secondary-container flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({totalCount})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-surface-container-high">
          {recentReports.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant text-sm">
              No reports found in local cache. Create one to get started!
            </div>
          ) : (
            recentReports.map((report) => (
              <div
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className="py-3.5 first:pt-0 last:pb-0 hover:bg-surface-container-low/40 rounded-xl px-2 transition-colors cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-secondary">
                      {report.reportNumber || 'DRAFT'}
                    </span>
                    <StatusBadge status={report.status} size="sm" />
                    <PriorityBadge priority={report.priority} size="sm" />
                    <SyncBadge syncStatus={report.syncStatus} />
                  </div>
                  <h4 className="font-semibold text-sm text-on-surface truncate group-hover:text-secondary transition-colors">
                    {report.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                    {report.locationName && (
                      <span className="flex items-center gap-1 truncate max-w-xs">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {report.locationName}
                      </span>
                    )}
                    {report.assignedTeam && (
                      <span className="hidden sm:inline-block bg-surface-container px-1.5 py-0.5 rounded text-[10px] font-medium text-on-surface">
                        {report.assignedTeam}
                      </span>
                    )}
                    <span>{formatTimeAgo(report.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <ArrowUpRight className="w-4 h-4 text-on-surface-variant group-hover:text-secondary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
