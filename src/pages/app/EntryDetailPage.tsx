import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  CategoryLabel,
  ModalDialog,
  SkeletonEntriesList,
  useToast,
} from '../../components/ui/Primitives';
import { useJournal } from '../../features/journal/JournalContext';
import type { JournalEntry } from '../../types/journal';
import { formatReadableDate, formatReadableTime } from './DashboardPage';
import { EntryEditorForm } from './EntryEditorPage';

export const EntryDetailPage: React.FC = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getEntryById, deleteEntry } = useJournal();
  const { showToast } = useToast();

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isEditing = searchParams.get('edit') === 'true';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!entryId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const result = await getEntryById(entryId);
        if (!cancelled) {
          setEntry(result);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entryId, getEntryById]);

  const handleConfirmDelete = async () => {
    if (!entry) return;
    setIsDeleting(true);
    try {
      await deleteEntry(entry.id);
      showToast('Observation removed from your journal.', 'info');
      navigate('/app/journal', { replace: true });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to delete observation.',
        'error'
      );
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <SkeletonEntriesList rows={2} />
      </div>
    );
  }

  if (!entry) {
    return (
      <div
        className="glass edge"
        style={{
          maxWidth: '580px',
          margin: 'var(--space-5) auto',
          padding: 'var(--space-4)',
          textAlign: 'center',
        }}
      >
        <h1 className="heading-card" style={{ marginBottom: 'var(--space-1)' }}>
          Observation not found
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          This journal entry could not be found or you do not have permission to read it.
        </p>
        <Link to="/app/journal" style={{ textDecoration: 'none' }}>
          <Button variant="primary">Return to archive</Button>
        </Link>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <p className="font-mono-meta" style={{ color: 'var(--accent-b)', margin: '0 0 var(--space-1) 0' }}>
            EDITING OBSERVATION
          </p>
          <h1 className="heading-section display-gradient" style={{ margin: 0 }}>
            Revise field note
          </h1>
        </header>
        <EntryEditorForm
          existingEntry={entry}
          onSuccess={(updated) => {
            setEntry(updated);
            setSearchParams({});
          }}
          onCancel={() => setSearchParams({})}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Link
          to="/app/journal"
          style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)', textDecoration: 'none' }}
        >
          Back to journal archive
        </Link>
      </div>

      <article className="glass edge" style={{ padding: 'var(--space-4)' }}>
        <header
          style={{
            paddingBottom: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-1)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <CategoryLabel category={entry.category} />
            <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
              Observed {formatReadableDate(entry.observedAt)} at{' '}
              {formatReadableTime(entry.observedAt)}
            </span>
          </div>

          <h1 className="heading-section" style={{ fontSize: 'var(--step-3)', marginBottom: 'var(--space-1)' }}>
            {entry.title}
          </h1>

          {entry.placeLabel && (
            <p className="font-mono-meta" style={{ color: 'var(--accent-b)', margin: 0 }}>
              Place: {entry.placeLabel}
            </p>
          )}
        </header>

        <div
          style={{
            fontSize: 'var(--step-1)',
            lineHeight: 1.7,
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            marginBottom: 'var(--space-4)',
          }}
        >
          {entry.note}
        </div>

        {entry.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-1)',
              paddingBottom: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--line)',
            }}
          >
            {entry.tags.map((tag) => (
              <Link
                key={tag}
                to={`/app/journal?q=${encodeURIComponent(tag)}`}
                className="tag-chip"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
            Last updated: {formatReadableDate(entry.updatedAt)}
          </span>

          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchParams({ edit: 'true' })}
            >
              Edit observation
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete
            </Button>
          </div>
        </footer>
      </article>

      <ModalDialog
        isOpen={showDeleteModal}
        title="Delete this observation?"
        description={`"${entry.title}" will be permanently removed from your field journal. This action cannot be undone.`}
        onClose={() => setShowDeleteModal(false)}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            disabled={isDeleting}
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={isDeleting}
            onClick={() => void handleConfirmDelete()}
          >
            Permanently delete
          </Button>
        </div>
      </ModalDialog>
    </div>
  );
};
