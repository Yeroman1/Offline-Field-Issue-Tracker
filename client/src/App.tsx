import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { DashboardPage } from './pages/DashboardPage';
import { AllReportsPage } from './pages/AllReportsPage';
import { CreateReportPage } from './pages/CreateReportPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { MyReportsPage } from './pages/MyReportsPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';

const AppContent: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col justify-center items-center">
        <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-on-surface-variant">Connecting to Supabase Auth...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Header />

      <main className="flex-1 pb-20 md:pb-8 max-w-full overflow-x-hidden">
        <Routes>
          {/* 1. Dashboard */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          {/* 2. Report Creation */}
          <Route path="/create" element={<CreateReportPage />} />

          {/* 3. All Reports */}
          <Route path="/reports" element={<AllReportsPage />} />

          {/* 4. Report Details */}
          <Route path="/reports/:id" element={<ReportDetailPage />} />

          {/* 5. My Reports */}
          <Route path="/my-reports" element={<MyReportsPage />} />

          {/* 6. Activity History */}
          <Route path="/activity" element={<ActivityPage />} />

          {/* 7. Settings */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
