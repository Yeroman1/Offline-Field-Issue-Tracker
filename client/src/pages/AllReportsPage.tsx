import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { StatusBadge, PriorityBadge, SyncBadge, CategoryIcon } from '../components/Badge';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  Map as MapIcon,
  List,
  Plus,
  ArrowUpDown,
  HardHat,
  Database,
  CloudOff,
  CheckCircle2,
} from 'lucide-react';

interface AllReportsPageProps {
  onSelectReport?: (reportId: string) => void;
  onNavigateCreate?: () => void;
  initialFilter?: { status?: string; reporterId?: string };
}

export const AllReportsPage: React.FC<AllReportsPageProps> = ({
  onSelectReport,
  onNavigateCreate,
  initialFilter,
}) => {
  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    if (onSelectReport) onSelectReport(id);
    else navigate(`/reports/${id}`);
  };

  const handleCreate = () => {
    if (onNavigateCreate) onNavigateCreate();
    else navigate('/create');
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(
    initialFilter?.status || 'all'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSync, setSelectedSync] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Query all reports live from Dexie
  const reports = useLiveQuery(() => db.reports.toArray(), []) || [];

  // Metrics for cache retention bar
  const totalReports = reports.length;
  const syncedCount = reports.filter((r) => r.syncStatus === 'synced').length;
  const queuedCount = reports.filter((r) => r.syncStatus === 'pending').length;
  const failedCount = reports.filter((r) => r.syncStatus === 'failed').length;

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    return reports
      .filter((r) => {
        // Initial filter by reporterId if requested (e.g. for Mine view)
        if (initialFilter?.reporterId && r.reporterId !== initialFilter.reporterId) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = r.title.toLowerCase().includes(q);
          const matchNumber = r.reportNumber.toLowerCase().includes(q);
          const matchDesc = r.description?.toLowerCase().includes(q);
          const matchLoc = r.locationName?.toLowerCase().includes(q);
          if (!matchTitle && !matchNumber && !matchDesc && !matchLoc) {
            return false;
          }
        }

        // Status filter
        if (selectedStatus !== 'all' && r.status !== selectedStatus) {
          return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && r.category !== selectedCategory) {
          return false;
        }

        // Sync filter
        if (selectedSync !== 'all' && r.syncStatus !== selectedSync) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'priority') {
          const order: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
          return (order[b.priority] || 0) - (order[a.priority] || 0);
        }
        return 0;
      });
  }, [reports, searchQuery, selectedStatus, selectedCategory, selectedSync, sortBy, initialFilter]);

  const statusChips = [
    { id: 'all', label: 'All' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'assigned', label: 'Assigned' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'rejected', label: 'Declined' },
    { id: 'draft', label: 'Draft' },
  ];

  const categoryChips = [
    'all',
    'Water',
    'Equipment',
    'Infrastructure',
    'Safety',
    'Maintenance',
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5 pb-28 space-y-4 sm:space-y-5">
      {/* Offline Cache Retention Bar */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-container text-tertiary-fixed flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface flex items-center gap-2">
              <span>Offline Cache Retention</span>
              <span className="text-[11px] font-mono text-on-surface-variant font-normal">
                ({totalReports} total cached records)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mt-0.5">
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                {syncedCount} Synced
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                <CloudOff className="w-3 h-3" />
                {queuedCount} Queued
              </span>
              {failedCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-rose-700 font-medium">{failedCount} Failed</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* View Mode & Sort Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-surface-container-low px-2 py-1.5 rounded-xl border border-surface-container text-xs text-on-surface">
            <ArrowUpDown className="w-3.5 h-3.5 text-on-surface-variant" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">Highest Urgency</option>
            </select>
          </div>

          {/* List / Map switcher */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-surface-container">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'list'
                  ? 'bg-white shadow-xs text-secondary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'map'
                  ? 'bg-white shadow-xs text-secondary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              title="Tactical Map View"
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreate}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-xs font-semibold rounded-xl hover:bg-secondary-container transition-colors shadow-sm cursor-pointer"
            title="Create New Report"
          >
            <Plus className="w-3.5 h-3.5 text-tertiary-fixed" />
            <span>New Report</span>
          </button>
        </div>
      </div>

      {/* Live Search & Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports by title, ID (#NP-8821), location, or description..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-surface-container-high rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all min-h-[44px]"
          />
        </div>

        {/* Dual Filter Rails */}
        {/* Rail 1: Status Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {statusChips.map((chip) => {
            const active = selectedStatus === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setSelectedStatus(chip.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-secondary text-white shadow-xs'
                    : 'bg-surface-container-lowest border border-surface-container text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Rail 2: Category Chips & Sync Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider pl-1">
            Category:
          </span>
          {categoryChips.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-primary text-white font-semibold'
                    : 'bg-surface-container-lowest border border-surface-container text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {cat === 'all' ? 'All Disciplines' : cat}
              </button>
            );
          })}

          <div className="h-4 w-px bg-surface-container mx-1" />

          {/* Sync Status Filter Pill */}
          {['all', 'synced', 'pending'].map((s) => {
            const active = selectedSync === s;
            return (
              <button
                key={s}
                onClick={() => setSelectedSync(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap capitalize transition-colors ${
                  active
                    ? 'bg-primary-container text-tertiary-fixed font-semibold'
                    : 'bg-surface-container-lowest border border-surface-container text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {s === 'all' ? 'Any Sync' : s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: List View or Map View */}
      {viewMode === 'map' ? (
        /* Tactical Map Telemetry View */
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <MapPin className="w-5 h-5 text-secondary" />
                <span>Geospatial Telemetry Grid (Nile Basin Sector Map)</span>
              </h3>
              <p className="text-xs text-on-surface-variant">
                Tactical visual plot of {filteredReports.length} incidents across monitored infrastructure coordinates.
              </p>
            </div>
          </div>

          {/* Interactive Visual Map Representation */}
          <div className="relative w-full h-96 bg-primary-container rounded-2xl overflow-hidden border border-slate-700 p-4">
            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

            {/* River Nile Visual Graphic Flow */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <path
                d="M 50,0 Q 42,30 55,60 T 48,100"
                fill="none"
                stroke="#316bf3"
                strokeWidth="6"
              />
            </svg>

            {/* Coordinates Points */}
            <div className="relative w-full h-full">
              {filteredReports.map((report, idx) => {
                // Approximate relative position
                const posX = 15 + ((idx * 23) % 70);
                const posY = 15 + ((idx * 31) % 65);

                const priorityColors: Record<string, string> = {
                  Critical: 'bg-rose-500 ring-rose-300 animate-ping',
                  High: 'bg-amber-500 ring-amber-300',
                  Medium: 'bg-blue-500 ring-blue-300',
                  Low: 'bg-emerald-500 ring-emerald-300',
                };

                return (
                  <div
                    key={report.id}
                    onClick={() => handleSelect(report.id)}
                    style={{ left: `${posX}%`, top: `${posY}%` }}
                    className="absolute cursor-pointer group transform -translate-x-1/2 -translate-y-1/2 z-20"
                  >
                    <div className="relative flex items-center justify-center">
                      <span
                        className={`w-3.5 h-3.5 rounded-full ${
                          priorityColors[report.priority] || 'bg-blue-500'
                        } ring-4 shadow-lg`}
                      />
                      {/* Tooltip Card on Hover */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-primary text-white p-2.5 rounded-xl shadow-2xl border border-slate-700 w-48 text-left z-30 pointer-events-none">
                        <div className="flex items-center justify-between text-[10px] font-mono text-tertiary-fixed">
                          <span>{report.reportNumber}</span>
                          <span>{report.priority}</span>
                        </div>
                        <div className="text-xs font-semibold text-white truncate mt-0.5">
                          {report.title}
                        </div>
                        <div className="text-[10px] text-surface-container-high/70 mt-1 truncate">
                          {report.locationName || 'Field Sector'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-3 left-3 bg-primary/90 backdrop-blur-md border border-slate-700 rounded-xl p-2.5 text-[11px] text-white flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Critical
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> High
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Medium
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Low
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Rich Report Cards List */
        <div className="space-y-3">
          {filteredReports.length === 0 ? (
            <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-12 text-center">
              <Search className="w-8 h-8 text-on-surface-variant mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-semibold text-on-surface">No reports match your filters</h4>
              <p className="text-xs text-on-surface-variant mt-1">
                Try clearing search terms or changing category/status rails.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => handleSelect(report.id)}
                className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-secondary/50 transition-all cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-secondary bg-surface-container-low px-2 py-0.5 rounded-md border border-surface-container">
                        {report.reportNumber}
                      </span>
                      <StatusBadge status={report.status} />
                      <PriorityBadge priority={report.priority} />
                      <SyncBadge syncStatus={report.syncStatus} />
                    </div>

                    <h3 className="font-bold text-base text-on-surface group-hover:text-secondary transition-colors">
                      {report.title}
                    </h3>

                    {report.description && (
                      <p className="text-xs text-on-surface-variant line-clamp-2">
                        {report.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-on-surface-variant flex-wrap pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <CategoryIcon category={report.category} className="w-3.5 h-3.5" />
                        {report.category}
                      </span>

                      {report.locationName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {report.locationName}
                        </span>
                      )}

                      {report.assignedTeam && (
                        <span className="inline-flex items-center gap-1 bg-surface-container px-2 py-0.5 rounded text-[11px] font-medium text-on-surface">
                          <HardHat className="w-3 h-3 text-secondary" />
                          {report.assignedTeam}
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {new Date(report.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Thumbnail if photo present */}
                  {report.photoUrl && (
                    <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-surface-container relative self-start sm:self-center">
                      <img
                        src={report.photoUrl}
                        alt="Evidence"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating "+ New Report" Action Button */}
      <button
        onClick={handleCreate}
        className="fixed bottom-20 right-4 sm:right-8 z-40 bg-secondary hover:bg-secondary-container text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs tracking-wider uppercase transition-transform hover:scale-105 active:scale-95 border-2 border-surface"
      >
        <Plus className="w-5 h-5 text-tertiary-fixed" />
        <span>New Report</span>
      </button>
    </div>
  );
};
