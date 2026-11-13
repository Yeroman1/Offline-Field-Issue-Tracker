import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab: propActiveTab,
  onSelectTab,
  pendingCount = 0,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getComputedTab = (): NavTab => {
    if (propActiveTab) return propActiveTab;
    const p = location.pathname;
    if (p === '/create') return 'create';
    if (p.startsWith('/reports') && p !== '/reports') return 'all';
    if (p === '/reports') return 'all';
    if (p === '/my-reports') return 'mine';
    if (p === '/activity') return 'activity';
    if (p === '/settings') return 'settings';
    return 'dashboard';
  };

  const activeTab = getComputedTab();

  const handleTabClick = (tab: NavTab, route: string) => {
    if (onSelectTab) onSelectTab(tab);
    navigate(route);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-primary/95 backdrop-blur-md border-t border-primary-container text-white py-1 px-1 safe-area-bottom shadow-2xl"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="max-w-md mx-auto grid grid-cols-6 items-center text-center">
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => handleTabClick('dashboard', '/')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
            activeTab === 'dashboard'
              ? 'text-tertiary-fixed font-bold'
              : 'text-surface-container-high/70 hover:text-white'
          }`}
          aria-label="Dashboard"
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Dash</span>
        </button>

        {/* All Reports */}
        <button
          type="button"
          onClick={() => handleTabClick('all', '/reports')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
            activeTab === 'all'
              ? 'text-tertiary-fixed font-bold'
              : 'text-surface-container-high/70 hover:text-white'
          }`}
          aria-label="All Reports Feed"
        >
          <ClipboardList className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">All</span>
        </button>

        {/* Create + (Centerpiece) */}
        <button
          type="button"
          onClick={() => handleTabClick('create', '/create')}
          className="flex flex-col items-center justify-center -mt-3.5 group cursor-pointer min-h-[48px] min-w-[48px]"
          title="File New Field Report"
          aria-label="Create New Field Report"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-secondary to-secondary-container text-white flex items-center justify-center shadow-lg border-2 border-primary group-hover:scale-105 group-active:scale-95 transition-transform">
            <PlusCircle className="w-6 h-6 text-tertiary-fixed" />
          </div>
          <span className="text-[9px] font-bold text-tertiary-fixed tracking-tight mt-0.5">
            New
          </span>
        </button>

        {/* Mine */}
        <button
          type="button"
          onClick={() => handleTabClick('mine', '/my-reports')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
            activeTab === 'mine'
              ? 'text-tertiary-fixed font-bold'
              : 'text-surface-container-high/70 hover:text-white'
          }`}
          aria-label="My Filed Reports"
        >
          <UserCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Mine</span>
        </button>

        {/* Activity */}
        <button
          type="button"
          onClick={() => handleTabClick('activity', '/activity')}
          className={`flex flex-col items-center justify-center py-1 relative transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
            activeTab === 'activity'
              ? 'text-tertiary-fixed font-bold'
              : 'text-surface-container-high/70 hover:text-white'
          }`}
          aria-label="Operations and Outbox Activity"
        >
          {pendingCount > 0 && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-primary animate-ping" />
          )}
          <History className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Activity</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => handleTabClick('settings', '/settings')}
          className={`flex flex-col items-center justify-center py-1 transition-all cursor-pointer min-h-[44px] min-w-[44px] ${
            activeTab === 'settings'
              ? 'text-tertiary-fixed font-bold'
              : 'text-surface-container-high/70 hover:text-white'
          }`}
          aria-label="Application Settings"
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">Settings</span>
        </button>
      </div>
    </nav>
  );
};
