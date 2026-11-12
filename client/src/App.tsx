import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { DashboardPage } from './pages/DashboardPage';
import { AllReportsPage } from './pages/AllReportsPage';
import { CreateReportPage } from './pages/CreateReportPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityPage } from './pages/ActivityPage';
import { seedDatabaseIfEmpty } from './db/db';
import { useUserRole } from './hooks/useUserRole';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { user } = useUserRole();

  useEffect(() => {
    seedDatabaseIfEmpty().catch(console.error);
  }, []);

  const handleSelectReport = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleBackFromDetail = () => {
    setSelectedReportId(null);
  };

  const handleCreateSuccess = (reportId: string) => {
    setSelectedReportId(reportId);
  };

  const handleTabChange = (tab: NavTab) => {
    setSelectedReportId(null);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Header onNavigateSettings={() => handleTabChange('settings')} />

      <main className="flex-1">
        {selectedReportId ? (
          <ReportDetailPage
            reportId={selectedReportId}
            onBack={handleBackFromDetail}
          />
        ) : activeTab === 'dashboard' ? (
          <DashboardPage
            onNavigateCreate={() => handleTabChange('create')}
            onNavigateAll={() => handleTabChange('all')}
            onSelectReport={handleSelectReport}
          />
        ) : activeTab === 'all' ? (
          <AllReportsPage
            onSelectReport={handleSelectReport}
            onNavigateCreate={() => handleTabChange('create')}
          />
        ) : activeTab === 'create' ? (
          <CreateReportPage
            onBack={() => handleTabChange('dashboard')}
            onSuccess={handleCreateSuccess}
          />
        ) : activeTab === 'mine' ? (
          <AllReportsPage
            onSelectReport={handleSelectReport}
            onNavigateCreate={() => handleTabChange('create')}
            initialFilter={{ reporterId: user.id }}
          />
        ) : activeTab === 'activity' ? (
          <ActivityPage />
        ) : activeTab === 'settings' ? (
          <SettingsPage />
        ) : null}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleTabChange}
      />
    </div>
  );
};

export default App;
