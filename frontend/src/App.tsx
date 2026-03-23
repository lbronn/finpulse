import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import AuthLayout from '@/components/layout/AuthLayout';
import MainLayout from '@/components/layout/MainLayout';
import OfflineBanner from '@/components/layout/OfflineBanner';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import SignUpPage from '@/pages/SignUpPage';
import DashboardPage from '@/pages/DashboardPage';
import ExpensesPage from '@/pages/ExpensesPage';
import JournalPage from '@/pages/JournalPage';
import BudgetPage from '@/pages/BudgetPage';
import AnalysisPage from '@/pages/AnalysisPage';
import SettingsPage from '@/pages/SettingsPage';
import DemoPage from '@/pages/DemoPage';

export default function App() {
  const { initialize, loading, user } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ThemeProvider>
      {loading ? (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading FinPulse...</p>
          </div>
        </div>
      ) : (
        <>
          <BrowserRouter>
            <Toaster position="top-center" richColors />
            <OfflineBanner />
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/demo" element={<DemoPage />} />

              {/* Root: landing if unauthed, redirect to app if authed */}
              <Route
                path="/"
                element={user ? <Navigate to="/app" replace /> : <LandingPage />}
              />

              {/* Protected app routes */}
              <Route path="/app" element={<AuthLayout />}>
                <Route element={<MainLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="expenses" element={<ExpensesPage />} />
                  <Route path="journal" element={<JournalPage />} />
                  <Route path="budget" element={<BudgetPage />} />
                  <Route path="analysis" element={<AnalysisPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </>
      )}
    </ThemeProvider>
  );
}
