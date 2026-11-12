import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Report, ReportStatus } from '../types';
import { StatusBadge, PriorityBadge, SyncBadge, CategoryIcon } from '../components/Badge';
import { getNextAllowedStatuses, validateTransition } from '../lib/statusMachine';
import { syncEngine } from '../services/syncEngine';
import { useUserRole } from '../hooks/useUserRole';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  HardHat,
  User,
  Clock,
  Shield,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Send,
} from 'lucide-react';

interface ReportDetailPageProps {
  reportId: string;
  onBack: () => void;
}

export const ReportDetailPage: React.FC<ReportDetailPageProps> = ({
  reportId,
  onBack,
}) => {
  const { user } = useUserRole();

  // Live queries for this report and its activity logs
  const report = useLiveQuery(() => db.reports.get(reportId), [reportId]);
  const activityLogs = useLiveQuery(
    () =>
      db.activityLog
        .where('reportId')
        .equals(reportId)
        .reverse()
        .sortBy('createdAt'),
    [reportId]
  ) || [];

  // Action dialog state
  const [targetStatus, setTargetStatus] = useState<ReportStatus | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('Ahmed K.');
  const [assignedTeam, setAssignedTeam] = useState('Hydro Rapid Response Alpha');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-on-surface-variant text-sm mb-4">Report record not found.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-secondary text-white rounded-xl text-xs font-semibold"
        >
          Return to All Reports
        </button>
      </div>
    );
  }

  const allowedNext = getNextAllowedStatuses(report.status);

  const handleInitiateTransition = (next: ReportStatus) => {
    setTargetStatus(next);
    setResolutionNotes('');
  };

  const handleConfirmTransition = async () => {
    if (!targetStatus) return;
    setIsSubmitting(true);

    try {
      validateTransition(report.status, targetStatus);

      const updates: Partial<Report> = {
        status: targetStatus,
        version: (report.version || 1) + 1,
      };

      if (targetStatus === 'assigned') {
        updates.assignedTo = assignedTo;
        updates.assignedTeam = assignedTeam;
      }

      if (targetStatus === 'resolved') {
        updates.resolutionNotes = resolutionNotes || 'Issue verified and resolved on site';
        updates.resolvedBy = user.name;
        updates.resolvedAt = new Date().toISOString();
      }

      if (targetStatus === 'rejected') {
        updates.resolutionNotes = resolutionNotes || 'Declined during coordinator triage';
        updates.resolvedBy = user.name;
        updates.resolvedAt = new Date().toISOString();
      }

      // Enqueue to outbox and local DB
      await syncEngine.enqueueReportUpdate(report.id, updates, user.name);

      setFeedbackMsg(`Report status updated to ${targetStatus.toUpperCase()}`);
      setTimeout(() => setFeedbackMsg(null), 3500);
      setTargetStatus(null);
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusButtonConfig = (st: ReportStatus) => {
    switch (st) {
      case 'submitted':
        return { label: 'Submit Issue', icon: Send, color: 'bg-blue-600 hover:bg-blue-700' };
      case 'assigned':
        return { label: 'Assign Crew', icon: HardHat, color: 'bg-purple-600 hover:bg-purple-700' };
      case 'in_progress':
        return { label: 'Start Work', icon: Play, color: 'bg-amber-600 hover:bg-amber-700' };
      case 'resolved':
        return { label: 'Resolve & Close', icon: CheckCircle2, color: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'rejected':
        return { label: 'Decline / Reject', icon: XCircle, color: 'bg-rose-600 hover:bg-rose-700' };
      default:
        return { label: st, icon: RotateCcw, color: 'bg-slate-600 hover:bg-slate-700' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface bg-surface-container-low px-3 py-1.5 rounded-lg border border-surface-container transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        <div className="flex items-center gap-2">
          <SyncBadge syncStatus={report.syncStatus} />
          <span className="font-mono text-xs font-bold text-on-surface-variant">
            v{report.version || 1}
          </span>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Issue Card */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-6">
        {/* Title Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-secondary bg-surface-container-low px-2 py-0.5 rounded-md border border-surface-container">
              {report.reportNumber}
            </span>
            <StatusBadge status={report.status} />
            <PriorityBadge priority={report.priority} />
            <span className="flex items-center gap-1 text-xs font-medium text-on-surface-variant ml-auto">
              <CategoryIcon category={report.category} className="w-3.5 h-3.5" />
              {report.category}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-on-surface">
            {report.title}
          </h1>

          <div className="flex items-center gap-4 text-xs text-on-surface-variant flex-wrap pt-1">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Filed by <strong>{report.reporterName}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(report.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Description Box */}
        <div className="bg-surface-container-low/40 rounded-xl p-4 border border-surface-container text-sm text-on-surface leading-relaxed">
          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Field Observations & Description
          </h4>
          <p className="whitespace-pre-line">{report.description || 'No detailed description provided.'}</p>
        </div>

        {/* Resolution Notes if resolved or rejected */}
        {report.resolutionNotes && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Resolution Notes (by {report.resolvedBy || 'Coordinator'})
            </span>
            <p className="pl-5.5">{report.resolutionNotes}</p>
          </div>
        )}

        {/* Field Telemetry & Geolocation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-container-low/60 rounded-xl p-3.5 border border-surface-container space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
              Location / Asset Coordinate
            </span>
            <div className="flex items-center gap-2 font-medium text-xs text-on-surface">
              <MapPin className="w-4 h-4 text-secondary shrink-0" />
              <span>{report.locationName || 'Unspecified Field Coordinate'}</span>
            </div>
            {report.latitude && report.longitude && (
              <div className="text-[11px] font-mono text-on-surface-variant pl-6">
                {report.latitude.toFixed(5)}° N, {report.longitude.toFixed(5)}° E (±{report.locationAccuracy || 3.5}m)
              </div>
            )}
          </div>

          <div className="bg-surface-container-low/60 rounded-xl p-3.5 border border-surface-container space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
              Assignment & Operational Team
            </span>
            <div className="flex items-center gap-2 font-medium text-xs text-on-surface">
              <HardHat className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{report.assignedTeam || 'Unassigned Crew'}</span>
            </div>
            {report.assignedTo && (
              <div className="text-[11px] text-on-surface-variant pl-6">
                Officer Lead: <strong>{report.assignedTo}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Photographic Evidence Attachment */}
        {report.photoUrl && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Photographic Evidence
            </h4>
            <div className="max-w-md rounded-2xl overflow-hidden border border-surface-container shadow-xs">
              <img
                src={report.photoUrl}
                alt="Evidence visual"
                className="w-full h-64 object-cover"
              />
              <div className="p-2.5 bg-surface-container-lowest text-xs text-on-surface-variant flex items-center justify-between">
                <span>Field Image Capture #1</span>
                <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Stored Offline in IndexedDB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Coordinator Action Panel: State Machine Status Transitions */}
        <div className="border-t border-surface-container pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-secondary" />
                <span>Coordinator Action Panel (State Transitions)</span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Enforcing strict deterministic finite state transitions
              </p>
            </div>
            <span className="text-xs font-mono bg-surface-container-low px-2 py-1 rounded text-on-surface-variant">
              Current: <strong>{report.status}</strong>
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {allowedNext.length === 0 ? (
              <div className="text-xs text-on-surface-variant italic">
                No further transitions available from '{report.status}'.
              </div>
            ) : (
              allowedNext.map((nextSt) => {
                const cfg = getStatusButtonConfig(nextSt);
                const Icon = cfg.icon;
                return (
                  <button
                    key={nextSt}
                    onClick={() => handleInitiateTransition(nextSt)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm active:scale-95 ${cfg.color}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{cfg.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Action Modal / Inputs for Transition */}
          {targetStatus && (
            <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">
                  Configure Transition to: <span className="uppercase text-secondary">{targetStatus}</span>
                </span>
                <button
                  onClick={() => setTargetStatus(null)}
                  className="text-xs text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
              </div>

              {targetStatus === 'assigned' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block mb-1 font-semibold text-on-surface">Assignee Name</label>
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-surface-container"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-semibold text-on-surface">Field Team</label>
                    <input
                      type="text"
                      value={assignedTeam}
                      onChange={(e) => setAssignedTeam(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-surface-container"
                    />
                  </div>
                </div>
              )}

              {(targetStatus === 'resolved' || targetStatus === 'rejected') && (
                <div className="text-xs">
                  <label className="block mb-1 font-semibold text-on-surface">
                    {targetStatus === 'resolved' ? 'Resolution & Sign-off Notes' : 'Rejection Reason'}
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter details..."
                    className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-surface-container"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetStatus(null)}
                  className="px-3 py-1.5 rounded-lg border border-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-lowest"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmTransition}
                  className="px-4 py-1.5 rounded-lg bg-secondary text-white text-xs font-bold hover:bg-secondary-container shadow-sm"
                >
                  {isSubmitting ? 'Updating...' : 'Confirm Status Change'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log History Timeline */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <Clock className="w-4 h-4 text-secondary" />
          <span>Audit Log & Telemetry Timeline</span>
        </h3>

        {activityLogs.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No activity logs recorded yet.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container">
            {activityLogs.map((log) => (
              <div key={log.id} className="relative text-xs">
                {/* Dot */}
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-on-surface">{log.actorName}</span>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-on-surface-variant mt-0.5">{log.description}</p>
                {log.newValue && (
                  <span className="inline-block mt-1 font-mono text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
                    state: {log.newValue}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
