import React from 'react';
import { ReportStatus, ReportPriority, SyncStatus, ReportCategory } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CloudOff,
  Droplet,
  HardHat,
  Radio,
  RefreshCw,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';

export const StatusBadge: React.FC<{ status: ReportStatus; size?: 'sm' | 'md' }> = ({
  status,
  size = 'md',
}) => {
  const configs: Record<ReportStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
    draft: {
      label: 'Draft (Local)',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      icon: Clock,
    },
    submitted: {
      label: 'Submitted',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-300',
      icon: Clock,
    },
    assigned: {
      label: 'Assigned',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-300',
      icon: HardHat,
    },
    in_progress: {
      label: 'In Progress',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
      icon: Radio,
    },
    resolved: {
      label: 'Resolved',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-300',
      icon: CheckCircle2,
    },
    rejected: {
      label: 'Declined',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-300',
      icon: XCircle,
    },
  };

  const normalizedStatus = (status || 'draft').toLowerCase() as ReportStatus;
  const config = configs[normalizedStatus] || configs.draft;
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs font-semibold px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {config.label}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: ReportPriority; size?: 'sm' | 'md' }> = ({
  priority,
  size = 'md',
}) => {
  const configs: Record<ReportPriority, { label: string; bg: string; text: string; dot: string }> = {
    Low: { label: 'Low', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    Medium: { label: 'Medium', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    High: { label: 'High', bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
    Critical: { label: 'Critical', bg: 'bg-rose-100', text: 'text-rose-800', dot: 'bg-rose-600' },
  };

  const normalizedPriority = (
    priority ? priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase() : 'Low'
  ) as ReportPriority;
  const config = configs[normalizedPriority] || configs.Low;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs font-medium px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md ${config.bg} ${config.text} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

export const SyncBadge: React.FC<{ syncStatus: SyncStatus | 'syncing' }> = ({ syncStatus }) => {
  if (syncStatus === 'synced') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        Synchronized
      </span>
    );
  }
  if (syncStatus === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Synchronizing
      </span>
    );
  }
  if (syncStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
        <CloudOff className="w-3 h-3" />
        Pending synchronization
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
      <AlertTriangle className="w-3 h-3" />
      Synchronization failed
    </span>
  );
};

export const CategoryIcon: React.FC<{ category: ReportCategory | string; className?: string }> = ({
  category,
  className = 'w-4 h-4',
}) => {
  const norm = (category || '').toLowerCase();
  if (norm.includes('water')) {
    return <Droplet className={`${className} text-cyan-600`} />;
  }
  if (norm.includes('equip')) {
    return <Wrench className={`${className} text-indigo-600`} />;
  }
  if (norm.includes('infra')) {
    return <HardHat className={`${className} text-amber-600`} />;
  }
  if (norm.includes('safe')) {
    return <ShieldAlert className={`${className} text-rose-600`} />;
  }
  if (norm.includes('maint') || norm.includes('service')) {
    return <Wrench className={`${className} text-emerald-600`} />;
  }
  return <AlertTriangle className={`${className} text-slate-500`} />;
};
