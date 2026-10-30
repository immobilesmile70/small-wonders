import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Button, useToast } from '../ui/Primitives';

export interface AppShellProps {
  children: React.ReactNode;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ children, theme, onToggleTheme }) => {
  const { user, isFirebaseConfigured, signOut, markEmailVerifiedInSandbox } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out of your field journal.', 'info');
    navigate('/');
  };

  const navItems = [
    { path: '/app', label: 'Notebook' },
    { path: '/app/journal', label: 'Archive' },
    { path: '/app/new', label: 'Record observation' },
    { path: '/app/settings', label: 'Settings' },
  ];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <a href="#app-main-content" className="skip-link">
        Skip to journal content
      </a>

      {!user?.emailVerified && (
        <div
          role="region"
          aria-label="Email verification required"
          style={{
            backgroundColor: 'var(--surface-2)',
            borderBottom: '1px solid var(--line-strong)',
            padding: '0.65rem 1.25rem',
            fontSize: '0.85rem',
            marginTop: '4.5rem',
          }}
        >
          <div
            className="premium-container"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <span>
              Please verify <strong>{user?.email}</strong> before creating or editing observations.
            </span>
            {!isFirebaseConfigured && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void markEmailVerifiedInSandbox()}
              >
                Complete verification (Sandbox)
              </Button>
            )}
          </div>
        </div>
      )}

      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="header-island">
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <Link
              to="/app"
              className="font-serif"
              style={{
                textDecoration: 'none',
                color: 'var(--text)',
                fontSize: '1.45rem',
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              Small Wonders.
            </Link>

            <nav
              aria-label="Journal navigation"
              style={{ display: 'flex', alignItems: 'center', gap: '1.35rem', flexWrap: 'wrap' }}
            >
              {navItems.map((item) => {
                const isActive =
                  item.path === '/app'
                    ? location.pathname === '/app'
                    : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="nav-link"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-pill btn-secondary btn-pill-sm"
            >
              {theme === 'dark' ? 'Light' : 'Carbon'}
            </button>
            <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main
        id="app-main-content"
        className="premium-container"
        style={{ flex: 1, paddingTop: '5.5rem', paddingBottom: '5rem' }}
      >
        {children}
      </main>
    </div>
  );
};
