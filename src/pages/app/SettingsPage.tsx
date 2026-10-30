import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Button,
  InputField,
  ModalDialog,
  SpotlightCard,
  useToast,
} from '../../components/ui/Primitives';
import { useAuth } from '../../features/auth/AuthContext';
import { useJournal } from '../../features/journal/JournalContext';

export const SettingsPage: React.FC = () => {
  const { user, isFirebaseConfigured, usingEmulators, signOut } = useAuth();
  const { deleteAccountAndAllData, exportUserJournalJson } = useJournal();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportJson = () => {
    const jsonString = exportUserJournalJson();
    try {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `small-wonders-journal-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Downloaded JSON export of your journal.', 'success');
    } catch {
      showToast('Prepared journal export.', 'info');
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteAccountAndAllData(confirmationText);
      showToast('Your account and journal entries have been permanently deleted.', 'info');
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Account deletion could not be completed. Please sign in again and retry.'
      );
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <header
        style={{
          paddingBottom: 'var(--space-2)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <p className="font-mono-meta" style={{ color: 'var(--accent-b)', margin: '0 0 var(--space-1) 0' }}>
          ACCOUNT & PRIVACY
        </p>
        <h1 className="heading-section display-gradient" style={{ margin: 0 }}>
          Journal settings
        </h1>
      </header>

      <SpotlightCard as="section" featuredEdge>
        <h2 className="heading-card" style={{ marginBottom: 'var(--space-2)' }}>
          Account details
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-2)',
            fontSize: 'var(--step-0)',
          }}
        >
          <div>
            <div className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
              EMAIL ADDRESS
            </div>
            <div style={{ fontWeight: 500, marginTop: '0.2rem' }}>{user?.email}</div>
          </div>

          <div>
            <div className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
              AUTHENTICATION PROVIDER
            </div>
            <div style={{ fontWeight: 500, marginTop: '0.2rem' }}>
              {user?.providerId === 'google.com' ? 'Google Sign-In (OAuth 2.0)' : 'Email & Password'}
            </div>
          </div>

          <div>
            <div className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
              EMAIL VERIFICATION
            </div>
            <div style={{ fontWeight: 500, marginTop: '0.2rem' }}>
              {user?.emailVerified ? 'Verified owner' : 'Verification pending'}
            </div>
          </div>

          <div>
            <div className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
              RUNTIME ENVIRONMENT
            </div>
            <div style={{ fontWeight: 500, marginTop: '0.2rem' }}>
              {isFirebaseConfigured
                ? usingEmulators
                  ? 'Firebase Emulator Suite'
                  : 'Firebase Production Cloud'
                : 'Local Sandbox Mode (.env unconfigured)'}
            </div>
          </div>
        </div>

        <div style={{ paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--line)' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void signOut();
              navigate('/');
            }}
          >
            Sign out of this device
          </Button>
        </div>
      </SpotlightCard>

      <SpotlightCard as="section">
        <h2 className="heading-card" style={{ marginBottom: 'var(--space-1)' }}>
          Data ownership & export
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', marginBottom: 'var(--space-2)' }}>
          Your observations are scoped strictly to your authenticated UID under <code>users/&#123;uid&#125;/entries</code>. Client-side code has read-only access, and all writes are validated on the server. You can export your loaded observations as structured JSON at any time.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleExportJson}>
            Download journal JSON export
          </Button>
          <Link to="/privacy" style={{ fontSize: 'var(--step--1)', color: 'var(--accent-b)' }}>
            Read full Privacy Policy
          </Link>
        </div>
      </SpotlightCard>

      <section
        className="surface-panel"
        style={{
          borderColor: 'var(--danger)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        <h2 className="heading-card" style={{ color: 'var(--danger)', margin: 0 }}>
          Permanent account deletion
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', margin: 0 }}>
          Deleting your account invokes our authenticated serverless deletion workflow (<code>DELETE /api/account</code>), which removes your stored Firestore journal entries in batched transactions, deletes your user profile document, and then deletes your Firebase Authentication record.
        </p>
        <div>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmationText('');
              setDeleteError(null);
              setShowDeleteAccountModal(true);
            }}
          >
            Delete account and all entries
          </Button>
        </div>
      </section>

      <ModalDialog
        isOpen={showDeleteAccountModal}
        title="Permanently delete your journal?"
        description="This server-side operation removes your journal entries and deletes your authentication account. Type DELETE MY JOURNAL below to confirm."
        onClose={() => setShowDeleteAccountModal(false)}
      >
        <form
          onSubmit={(e) => void handleDeleteAccount(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          {deleteError && (
            <div
              role="alert"
              style={{
                padding: 'var(--space-2)',
                backgroundColor: 'var(--danger-surface)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--step--1)',
              }}
            >
              {deleteError}
            </div>
          )}

          <InputField
            label="Confirmation phrase"
            type="text"
            required
            placeholder="DELETE MY JOURNAL"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setShowDeleteAccountModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isDeleting}
              disabled={confirmationText.trim() !== 'DELETE MY JOURNAL'}
            >
              Confirm permanent deletion
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
