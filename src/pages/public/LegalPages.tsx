import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Primitives';

const EditorialLegalShell: React.FC<{
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: React.ReactNode;
}> = ({ title, subtitle, lastUpdated, children }) => {
  return (
    <article
      className="premium-container section-band"
      style={{ maxWidth: '720px', paddingTop: '7.5rem' }}
    >
      <header
        style={{
          paddingBottom: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <p className="font-mono-meta" style={{ color: 'var(--accent)', marginBottom: 'var(--space-1)' }}>
          Last updated: {lastUpdated}
        </p>
        <h1 className="heading-section" style={{ marginBottom: 'var(--space-2)' }}>
          {title}
        </h1>
        <p style={{ fontSize: 'var(--step-1)', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>
      </header>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          fontSize: 'var(--step-0)',
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </article>
  );
};

const EditorialSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--line)' }}>
    <h2 className="heading-card" style={{ marginBottom: 'var(--space-1)' }}>
      {title}
    </h2>
    {children}
  </section>
);

export const AboutPage: React.FC = () => {
  return (
    <EditorialLegalShell
      title="About Small Wonders"
      subtitle="An intimate digital field notebook for noticing the quiet details of everyday life."
      lastUpdated="October 2026"
    >
      <EditorialSection title="Why this notebook exists">
        <p style={{ color: 'var(--text-muted)' }}>
          Most modern software is built to accelerate, quantify, or broadcast. Small Wonders was designed for the opposite impulse: pausing for thirty seconds to record a detail that would otherwise evaporate from memory.
        </p>
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          Whether it is the geometry of twilight reflections on wet slate, a curious botanical specimen growing through concrete, or the acoustic hum of an old building, collecting these brief observations changes how a day feels as you live it.
        </p>
      </EditorialSection>

      <EditorialSection title="Private and security-first by design">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          Your journal is private by default. There are no public profiles, follower counts, or algorithmic feeds. Under the hood, Small Wonders uses Firebase Authentication and Cloud Firestore with strict read-only client rules. Every database write is authenticated, validated with strict schemas, and rate-limited through serverless functions.
        </p>
      </EditorialSection>

      <div style={{ paddingTop: 'var(--space-1)' }}>
        <Link to="/sign-up" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="lg">Start your journal</Button>
        </Link>
      </div>
    </EditorialLegalShell>
  );
};

export const TermsPage: React.FC = () => {
  return (
    <EditorialLegalShell
      title="Terms of Service"
      subtitle="Clear terms governing your use of the Small Wonders field journal."
      lastUpdated="October 2026"
    >
      <div className="glass" style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--step--1)', boxShadow: 'inset 3px 0 0 var(--accent)' }}>
        <strong>Deployment Owner Notice:</strong> This document is provided as an operational template aligned with the application architecture and is not attorney-reviewed legal advice. Review jurisdiction-specific clauses and configure operator contact details in environment variables before commercial launch.
      </div>

      <EditorialSection title="1. Acceptance of Terms">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          By creating an account or using Small Wonders, you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use the service.
        </p>
      </EditorialSection>

      <EditorialSection title="2. Eligibility and Account Responsibilities">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          You are responsible for maintaining the confidentiality of your sign-in credentials and for all activity that occurs under your authenticated account. You agree to provide accurate registration information and to verify ownership of your email address when prompted.
        </p>
      </EditorialSection>

      <EditorialSection title="3. Ownership of Your Journal Content">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          You retain full ownership of the titles, notes, tags, place labels, and observations you record in Small Wonders. You grant the service operator a strictly limited, non-exclusive, revocable license solely to store, back up, index, and display your content back to you when you are signed in.
        </p>
      </EditorialSection>

      <EditorialSection title="4. Permitted Use, Disclaimers & Account Termination">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          You may not attempt to bypass authentication, probe or abuse serverless API endpoints, exceed rate limits, or submit automated bulk payloads. You may export your observations or permanently delete your account and stored journal entries at any time from the Settings page.
        </p>
      </EditorialSection>
    </EditorialLegalShell>
  );
};

export const PrivacyPage: React.FC = () => {
  return (
    <EditorialLegalShell
      title="Privacy Policy"
      subtitle="An accurate explanation of what Small Wonders collects, how it is stored, and how you control your data."
      lastUpdated="October 2026"
    >
      <EditorialSection title="1. Information We Collect">
        <ul style={{ color: 'var(--text-muted)', margin: 0, paddingLeft: 'var(--space-3)' }}>
          <li>
            <strong>Account Identity:</strong> Your email address, display name (if provided), authentication provider identifier (Email/Password or Google Sign-In), and Firebase Authentication UID.
          </li>
          <li>
            <strong>Journal Observations:</strong> The entry title, note text, category, tags, observation timestamp, optional manual place label, and server-generated creation/update timestamps stored under <code>users/&#123;uid&#125;/entries/&#123;entryId&#125;</code>.
          </li>
          <li>
            <strong>Operational Security Metadata:</strong> Short-lived rate-limiting counters (keyed by UID and request IP) and structured server error logs that exclude your private journal text and bearer tokens.
          </li>
        </ul>
      </EditorialSection>

      <EditorialSection title="2. Location Data Policy">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          Small Wonders never requests browser GPS coordinates or device geolocation permissions. Place labels are optional text strings that you type manually.
        </p>
      </EditorialSection>

      <EditorialSection title="3. Infrastructure, Export, and Account Deletion">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          The application uses Google Firebase (Authentication and Cloud Firestore), Vercel Serverless Functions, and Upstash Redis. From the Settings page, you can download a JSON export of your loaded journal records or trigger permanent server-side deletion of your Firestore entries and Firebase Authentication account.
        </p>
      </EditorialSection>
    </EditorialLegalShell>
  );
};

export const CookiesPage: React.FC = () => {
  return (
    <EditorialLegalShell
      title="Cookies & Storage Disclosure"
      subtitle="How Small Wonders uses browser storage for authentication and preferences."
      lastUpdated="October 2026"
    >
      <EditorialSection title="Zero Advertising or Behavioral Tracking">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          Small Wonders does not load third-party advertising pixels, cross-site behavioral trackers, or session-replay scripts. Essential browser storage is used strictly for Firebase Authentication session persistence, App Check abuse prevention, and your display theme token preference (<code>sw_theme_pref</code>).
        </p>
      </EditorialSection>
    </EditorialLegalShell>
  );
};

export const AccessibilityPage: React.FC = () => {
  return (
    <EditorialLegalShell
      title="Accessibility Statement"
      subtitle="Our commitment to a calm, keyboard-navigable, and screen-reader-friendly field journal."
      lastUpdated="October 2026"
    >
      <EditorialSection title="Designed for Inclusive Reading, Contrast, and Reduced Motion">
        <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
          Small Wonders is built with semantic HTML landmarks, explicit form labels, ARIA live announcements for status and validation feedback, keyboard-accessible dialogs with focus restoration, WCAG AA contrast across both Carbon and Paper modes, and full <code>prefers-reduced-motion</code> compliance.
        </p>
      </EditorialSection>
    </EditorialLegalShell>
  );
};

export const NotFoundPage: React.FC = () => {
  return (
    <div
      className="premium-container section-band"
      style={{
        textAlign: 'center',
        maxWidth: '580px',
        paddingTop: '7.5rem',
      }}
    >
      <div className="glass" style={{ padding: 'var(--space-5) var(--space-4)' }}>
        <p className="font-mono-meta" style={{ color: 'var(--accent)' }}>
          404 / PAGE NOT FOUND
        </p>
        <h1 className="heading-section" style={{ marginBottom: 'var(--space-2)' }}>
          This page has wandered off the path.
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          The route you requested does not exist in Small Wonders. You can return to the front page or open your private notebook.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Button variant="primary">Return home</Button>
          </Link>
          <Link to="/app" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">Open notebook</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
