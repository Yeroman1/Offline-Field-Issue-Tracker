import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  UserCheck,
  History,
  Settings,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'all' | 'create' | 'mine' | 'activity' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  pendingCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-primary/95 backdrop-blur-md border-t border-primary-container text-white py-1.5 px-2 safe-area-bottom shadow-2xl">
      <div className="max-w-md mx-auto grid grid-cols-6 items-center text-center">
        {/* Dashboard */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'dashboard'
              ? 'text-tertiary-fixed scale-105 font-semibold'
              : 'text-surface-container-high/60 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Dash</span>
        </button>

        {/* All Reports */}
        <button
          onClick={() => onSelectTab('all')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'all'
              ? 'text-tertiary-fixed scale-105 font-semibold'
              : 'text-surface-container-high/60 hover:text-white'
          }`}
        >
          <ClipboardList className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">All</span>
        </button>

        {/* Create + (Centerpiece) */}
        <button
          onClick={() => onSelectTab('create')}
          className="flex flex-col items-center justify-center -mt-4 group"
          title="File New Field Report"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-secondary to-secondary-container text-white flex items-center justify-center shadow-lg border-2 border-primary group-hover:scale-110 group-active:scale-95 transition-transform">
            <PlusCircle className="w-6 h-6 text-tertiary-fixed" />
          </div>
          <span className="text-[10px] font-bold text-tertiary-fixed tracking-tight mt-0.5">
            Create
          </span>
        </button>

        {/* Mine */}
        <button
          onClick={() => onSelectTab('mine')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'mine'
              ? 'text-tertiary-fixed scale-105 font-semibold'
              : 'text-surface-container-high/60 hover:text-white'
          }`}
        >
          <UserCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Mine</span>
        </button>

        {/* Activity */}
        <button
          onClick={() => onSelectTab('activity')}
          className={`flex flex-col items-center justify-center py-1 relative transition-all ${
            activeTab === 'activity'
              ? 'text-tertiary-fixed scale-105 font-semibold'
              : 'text-surface-container-high/60 hover:text-white'
          }`}
        >
          {pendingCount > 0 && (
            <span className="absolute top-0.5 right-3 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-primary animate-ping" />
          )}
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Activity</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => onSelectTab('settings')}
          className={`flex flex-col items-center justify-center py-1 transition-all ${
            activeTab === 'settings'
              ? 'text-tertiary-fixed scale-105 font-semibold'
              : 'text-surface-container-high/60 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Config</span>
        </button>
      </div>
    </nav>
  );
};
