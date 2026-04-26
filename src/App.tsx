import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import Planner from './pages/Planner';
import { CanvasPages } from './pages/CanvasPages';
import { Assignments } from './pages/Assignments';
import { Announcements } from './pages/Announcements';
import NewsletterBuilder from './pages/NewsletterBuilder';
import { Resources } from './pages/Resources';
import { Settings } from './pages/Settings';
import { Templates } from './pages/Templates';
import { SyllabusMapper } from './components/planner/SyllabusMapper';
import AnnouncementCommandCenter from './pages/AnnouncementCommandCenter';
import { useStore } from './store';
import React, { Suspense, useEffect } from 'react';

const ConfigLoader = () => {
  const { canvasApiToken, setSettings } = useStore();

  useEffect(() => {
    const pullConfig = async () => {
      if (!canvasApiToken) {
        try {
          const response = await fetch('/api/config/canvas-token');
          if (response.ok) {
            const { token } = await response.json();
            if (token) {
              setSettings({ canvasApiToken: token });
              console.log('[SYSTEM] Canvas API Token pulled from server environment.');
            }
          }
        } catch (err) {
          // Fail silently, user can still enter it manually in Settings
        }
      }
    };
    pullConfig();
  }, [canvasApiToken, setSettings]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAllowedUser, logOut } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAllowedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] text-white flex-col gap-6 p-4 text-center">
        <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center shadow-2xl">
          <span className="text-2xl font-bold text-red-500">!</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Access Restricted</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Your account <span className="text-red-400 font-mono">({user.email})</span> has passed authentication but is not specifically authorized for this terminal.
          </p>
        </div>
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Authorized Master Personnel</p>
          <div className="space-y-1">
            <p className="text-xs text-emerald-500 font-medium">owen.reagan@thalesacademy.org</p>
            <p className="text-xs text-emerald-500 font-medium">oreagan81@gmail.com</p>
          </div>
        </div>
        <button 
          onClick={() => logOut()} 
          className="text-xs uppercase font-bold tracking-widest text-slate-500 hover:text-white transition-colors"
        >
          Sign Out / Switch Account
        </button>
      </div>
    );
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
};

export default function App() {
  const selectedWeek = useStore(state => state.selectedWeek);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigLoader />
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="planner" element={<Planner />} />
                <Route path="syllabus-mapper" element={<SyllabusMapper weekId={selectedWeek} />} />
                <Route path="canvas-pages" element={<CanvasPages />} />
                <Route path="assignments" element={<Assignments />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="newsletters" element={<NewsletterBuilder />} />
                <Route path="command-center" element={<AnnouncementCommandCenter />} />
                <Route path="resources" element={<Resources />} />
                <Route path="settings" element={<Settings />} />
                <Route path="templates" element={<Templates />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster theme="dark" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
