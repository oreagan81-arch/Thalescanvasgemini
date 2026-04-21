import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Planner } from './pages/Planner';
import { CanvasPages } from './pages/CanvasPages';
import { Assignments } from './pages/Assignments';
import { Announcements } from './pages/Announcements';
import { Resources } from './pages/Resources';
import { Settings } from './pages/Settings';

import React, { Suspense } from 'react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAllowedUser } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAllowedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white flex-col gap-4">
        <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
        <p className="text-zinc-400">Your account ({user.email}) is not authorized.</p>
        <p className="text-zinc-400">Only owen.reagan@thalesacademy.org is permitted.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  return (
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
              <Route path="canvas-pages" element={<CanvasPages />} />
              <Route path="assignments" element={<Assignments />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="resources" element={<Resources />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" />
      </TooltipProvider>
    </AuthProvider>
  );
}
