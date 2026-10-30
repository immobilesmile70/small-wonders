import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PublicLayout } from '../components/layout/PublicLayout';
import { SkeletonEntriesList } from '../components/ui/Primitives';
import { useAuth } from '../features/auth/AuthContext';
import {
  ForgotPasswordPage,
  SignInPage,
  SignUpPage,
  VerifyEmailPage,
} from '../pages/auth/AuthPages';
import { LandingPage } from '../pages/public/LandingPage';
import {
  AboutPage,
  AccessibilityPage,
  CookiesPage,
  NotFoundPage,
  PrivacyPage,
  TermsPage,
} from '../pages/public/LegalPages';

const DashboardPage = lazy(() =>
  import('../pages/app/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const JournalArchivePage = lazy(() =>
  import('../pages/app/JournalArchivePage').then((m) => ({ default: m.JournalArchivePage }))
);
const EntryEditorPage = lazy(() =>
  import('../pages/app/EntryEditorPage').then((m) => ({ default: m.EntryEditorPage }))
);
const EntryDetailPage = lazy(() =>
  import('../pages/app/EntryDetailPage').then((m) => ({ default: m.EntryDetailPage }))
);
const SettingsPage = lazy(() =>
  import('../pages/app/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

export interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Prevents protected content from briefly rendering while Firebase Auth initializes,
 * and redirects unauthenticated visitors to `/sign-in` while preserving their requested path.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return (
      <div className="editorial-container" style={{ paddingTop: '4rem' }}>
        <SkeletonEntriesList rows={3} />
      </div>
    );
  }

  if (status === 'signed_out') {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/sign-in?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
};

export interface AppRouterProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({ theme, onToggleTheme }) => {
  return (
    <Routes>
      {/* Public & Informational Routes */}
      <Route
        path="/"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <LandingPage />
          </PublicLayout>
        }
      />
      <Route
        path="/about"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <AboutPage />
          </PublicLayout>
        }
      />
      <Route
        path="/terms"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <TermsPage />
          </PublicLayout>
        }
      />
      <Route
        path="/privacy"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <PrivacyPage />
          </PublicLayout>
        }
      />
      <Route
        path="/cookies"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <CookiesPage />
          </PublicLayout>
        }
      />
      <Route
        path="/accessibility"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <AccessibilityPage />
          </PublicLayout>
        }
      />

      {/* Authentication Routes */}
      <Route
        path="/sign-in"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <SignInPage />
          </PublicLayout>
        }
      />
      <Route
        path="/sign-up"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <SignUpPage />
          </PublicLayout>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <ForgotPasswordPage />
          </PublicLayout>
        }
      />
      <Route
        path="/verify-email"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <VerifyEmailPage />
          </PublicLayout>
        }
      />

      {/* Protected Field Journal Application Routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell theme={theme} onToggleTheme={onToggleTheme}>
              <Suspense fallback={<SkeletonEntriesList rows={3} />}>
                <DashboardPage />
              </Suspense>
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/journal"
        element={
          <ProtectedRoute>
            <AppShell theme={theme} onToggleTheme={onToggleTheme}>
              <Suspense fallback={<SkeletonEntriesList rows={4} />}>
                <JournalArchivePage />
              </Suspense>
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/new"
        element={
          <ProtectedRoute>
            <AppShell theme={theme} onToggleTheme={onToggleTheme}>
              <Suspense fallback={<SkeletonEntriesList rows={2} />}>
                <EntryEditorPage />
              </Suspense>
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/journal/:entryId"
        element={
          <ProtectedRoute>
            <AppShell theme={theme} onToggleTheme={onToggleTheme}>
              <Suspense fallback={<SkeletonEntriesList rows={2} />}>
                <EntryDetailPage />
              </Suspense>
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/settings"
        element={
          <ProtectedRoute>
            <AppShell theme={theme} onToggleTheme={onToggleTheme}>
              <Suspense fallback={<SkeletonEntriesList rows={2} />}>
                <SettingsPage />
              </Suspense>
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Catch-all 404 */}
      <Route
        path="*"
        element={
          <PublicLayout theme={theme} onToggleTheme={onToggleTheme}>
            <NotFoundPage />
          </PublicLayout>
        }
      />
    </Routes>
  );
};
