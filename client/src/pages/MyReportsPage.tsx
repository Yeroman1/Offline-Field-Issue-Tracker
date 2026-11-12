import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge, SyncBadge, CategoryIcon } from '../components/Badge';
import {
  Search,
  MapPin,
  Plus,
  UserCheck,
  ClipboardList,
} from 'lucide-react';

export const MyReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Query live reports authored by current active user
  const allReports = useLiveQuery(() => db.reports.toArray(), []) || [];
  const myReports = useMemo(() => {
    return allReports.filter(
      (r) => r.reporterId === user?.id || r.reporterName === profile?.fullName || r.reporterName === user?.email
    );
  }, [allReports, user, profile]);

  const filteredReports = useMemo(() => {
    return myReports.filter((r) => {
      if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.reportNumber.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.locationName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [myReports, statusFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-on-surface">My Filed Reports</h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-secondary-container text-white font-bold">
              {myReports.length} issues
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-secondary" />
            <span>Authenticated operator: <strong className="text-on-surface">{profile?.fullName || user?.email}</strong> ({profile?.role})</span>
          </p>
        </div>

        <button
          onClick={() => navigate('/create')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-secondary to-secondary-container text-white text-xs font-semibold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 text-tertiary-fixed" />
          <span>New Field Report</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-on-surface-variant/60" />
            <input
              type="text"
              placeholder="Search your reports by title, ID, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-surface-container-low border border-surface-container rounded-xl text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'draft', 'submitted', 'assigned', 'in_progress', 'resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-secondary text-white shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {st === 'in_progress' ? 'In Progress' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reports List / Empty State */}
      {filteredReports.length === 0 ? (
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-12 text-center shadow-sm space-y-3">
          <ClipboardList className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
          <h3 className="text-sm font-bold text-on-surface">No Reports Found</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            {myReports.length === 0
              ? `You haven't filed any field reports yet. Create a new issue report to begin logging field telemetry.`
              : 'No reports match your current filter query.'}
          </p>
          <button
            onClick={() => navigate('/create')}
            className="inline-flex items-center gap-1.5 px-4 py-2 mt-2 bg-secondary text-white rounded-xl text-xs font-semibold shadow hover:bg-secondary-container transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-tertiary-fixed" />
            <span>Create Your First Report</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => navigate(`/reports/${report.id}`)}
              className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm hover:border-secondary hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={report.category} />
                    <span className="font-mono text-xs font-bold text-on-surface">
                      {report.reportNumber || 'LOCAL-DRAFT'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SyncBadge syncStatus={report.syncStatus} />
                    <StatusBadge status={report.status} size="sm" />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-on-surface line-clamp-1 mb-1">
                  {report.title}
                </h3>
                <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">
                  {report.description}
                </p>
              </div>

              <div className="pt-3 border-t border-surface-container flex items-center justify-between text-[11px] text-on-surface-variant">
                <div className="flex items-center gap-1 truncate max-w-[180px]">
                  <MapPin className="w-3 h-3 text-secondary shrink-0" />
                  <span className="truncate">{report.locationName || 'Field Coordinates'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={report.priority} size="sm" />
                  <span className="font-mono text-[10px]">v{report.version || 1}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
