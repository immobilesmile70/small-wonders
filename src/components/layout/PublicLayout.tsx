import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Button } from '../ui/Primitives';

export interface PublicLayoutProps {
  children: React.ReactNode;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  theme,
  onToggleTheme,
}) => {
  const { status } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const isAuthenticated = status === 'authenticated' || status === 'verification_required';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Full-width transparent borderless header that animates into a centered floating island pill on scroll */}
      <header
        id="main-nav"
        className={`site-header${scrolled ? ' is-scrolled' : ''}`}
      >
        <div className="header-island">
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              fontSize: '1.35rem',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              color: 'var(--text)',
            }}
            className="font-serif"
          >
            Small Wonders
          </Link>

          <nav
            aria-label="Primary navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            <Link to="/#the-idea" className="nav-link">
              Observatory
            </Link>
            <Link to="/#works" className="nav-link">
              Field Structure
            </Link>
            <Link
              to="/about"
              className="nav-link"
              aria-current={location.pathname === '/about' ? 'page' : undefined}
            >
              About
            </Link>

            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-pill btn-secondary btn-pill-sm"
              aria-label={`Switch to ${theme === 'dark' ? 'Paper' : 'Carbon'} theme`}
            >
              {theme === 'dark' ? 'Paper' : 'Carbon'}
            </button>

            {isAuthenticated ? (
              <Link to="/app" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="sm">
                  Open Journal
                </Button>
              </Link>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link
                  to="/sign-in"
                  className="nav-link"
                  aria-current={location.pathname === '/sign-in' ? 'page' : undefined}
                >
                  Sign in
                </Link>
                <Link to="/sign-up" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="sm">
                    Start your journal
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>

      {/* Personal-Professional Archival Colophon Footer (no 15vw agency template watermark) */}
      <footer
        style={{
          padding: '3.5rem 0',
          borderTop: '1px solid var(--line)',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div
          className="premium-container"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '2rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span className="font-serif" style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)' }}>
              Small Wonders
            </span>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              A private field notebook for everyday observations. Read-only client rules, verified serverless writes.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginLeft: 'auto',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.35rem', fontSize: '0.875rem' }}>
              <Link to="/about" className="nav-link">
                About
              </Link>
              <Link to="/privacy" className="nav-link">
                Privacy
              </Link>
              <Link to="/terms" className="nav-link">
                Terms
              </Link>
              <Link to="/cookies" className="nav-link">
                Cookies
              </Link>
              <Link to="/accessibility" className="nav-link">
                Accessibility
              </Link>
            </div>
            <p className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              © {new Date().getFullYear()} Small Wonders. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
