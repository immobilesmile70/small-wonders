import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  InputField,
  ModalDialog,
  TextareaField,
  useToast,
} from '../../components/ui/Primitives';
import { useJournal } from '../../features/journal/JournalContext';
import { CATEGORY_METADATA } from '../../lib/designSystem';
import {
  MAX_NOTE_LENGTH,
  MAX_PLACE_LABEL_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS_COUNT,
  MAX_TITLE_LENGTH,
  normalizeSingleTag,
} from '../../schemas/entry';
import { MutationClientError } from '../../services/api-client/mutations';
import { ENTRY_CATEGORIES, type EntryCategory, type JournalEntry } from '../../types/journal';

function toLocalDateTimeInputValue(isoString?: string): string {
  const d = isoString ? new Date(isoString) : new Date();
  const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(
    safeDate.getDate()
  )}T${pad(safeDate.getHours())}:${pad(safeDate.getMinutes())}`;
}

export interface EntryEditorFormProps {
  existingEntry?: JournalEntry;
  onSuccess?: (saved: JournalEntry) => void;
  onCancel?: () => void;
}

export const EntryEditorForm: React.FC<EntryEditorFormProps> = ({
  existingEntry,
  onSuccess,
  onCancel,
}) => {
  const { createEntry, updateEntry } = useJournal();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const promptHint = searchParams.get('prompt') || '';

  const [title, setTitle] = useState(existingEntry?.title || '');
  const [note, setNote] = useState(existingEntry?.note || '');
  const [category, setCategory] = useState<EntryCategory>(
    existingEntry?.category || 'Light'
  );
  const [tags, setTags] = useState<string[]>(existingEntry?.tags || []);
  const [tagDraft, setTagDraft] = useState('');
  const [observedAtLocal, setObservedAtLocal] = useState(() =>
    toLocalDateTimeInputValue(existingEntry?.observedAt)
  );
  const [placeLabel, setPlaceLabel] = useState(existingEntry?.placeLabel || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const isDirty = useMemo(() => {
    if (existingEntry) {
      return (
        title !== existingEntry.title ||
        note !== existingEntry.note ||
        category !== existingEntry.category ||
        placeLabel !== (existingEntry.placeLabel || '') ||
        tags.join(',') !== existingEntry.tags.join(',')
      );
    }
    return (
      title.trim().length > 0 ||
      note.trim().length > 0 ||
      placeLabel.trim().length > 0 ||
      tags.length > 0
    );
  }, [existingEntry, title, note, category, placeLabel, tags]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSubmitting]);

  const handleAddTag = () => {
    const normalized = normalizeSingleTag(tagDraft);
    if (!normalized) {
      setTagDraft('');
      return;
    }
    if (normalized.length > MAX_TAG_LENGTH) {
      setFieldErrors((prev) => ({
        ...prev,
        tags: `Each tag must be ${MAX_TAG_LENGTH} characters or fewer.`,
      }));
      return;
    }
    if (!/^[a-z0-9][a-z0-9 -]*$/i.test(normalized)) {
      setFieldErrors((prev) => ({
        ...prev,
        tags: 'Tags may only contain letters, numbers, spaces, and hyphens.',
      }));
      return;
    }
    if (tags.includes(normalized)) {
      setTagDraft('');
      return;
    }
    if (tags.length >= MAX_TAGS_COUNT) {
      setFieldErrors((prev) => ({
        ...prev,
        tags: `Maximum ${MAX_TAGS_COUNT} tags per observation.`,
      }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.tags;
      return next;
    });
    setTags((prev) => [...prev, normalized]);
    setTagDraft('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const finalTags = [...tags];
    if (tagDraft.trim()) {
      const normalizedDraft = normalizeSingleTag(tagDraft);
      if (
        normalizedDraft &&
        normalizedDraft.length <= MAX_TAG_LENGTH &&
        !finalTags.includes(normalizedDraft) &&
        finalTags.length < MAX_TAGS_COUNT
      ) {
        finalTags.push(normalizedDraft);
      }
    }

    const parsedDateMs = Date.parse(observedAtLocal);
    if (Number.isNaN(parsedDateMs)) {
      setFieldErrors({ observedAt: 'Please enter a valid observation date and time.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        note,
        category,
        tags: finalTags,
        observedAt: new Date(parsedDateMs).toISOString(),
        placeLabel: placeLabel.trim() ? placeLabel.trim() : null,
      };

      const saved = existingEntry
        ? await updateEntry(existingEntry.id, payload)
        : await createEntry(payload);

      showToast(
        existingEntry ? 'Observation updated.' : 'Observation saved to your journal.',
        'success'
      );

      if (onSuccess) {
        onSuccess(saved);
      } else {
        navigate(`/app/journal/${saved.id}`);
      }
    } catch (err) {
      if (err instanceof MutationClientError) {
        setGeneralError(err.message);
        if (err.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.fieldErrors)) {
            if (v && v[0]) mapped[k] = v[0];
          }
          setFieldErrors(mapped);
        }
      } else {
        setGeneralError(
          err instanceof Error ? err.message : 'Unable to save your observation.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardModal(true);
      return;
    }
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="glass edge"
        style={{
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {promptHint && !existingEntry && (
          <div className="surface-elevated" style={{ fontSize: 'var(--step--1)' }}>
            <span className="font-mono-meta" style={{ color: 'var(--accent-b)' }}>
              PROMPT:{' '}
            </span>
            <em>“{promptHint}”</em>
          </div>
        )}

        {generalError && (
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
            {generalError}
          </div>
        )}

        <InputField
          label="Observation title"
          required
          maxLength={MAX_TITLE_LENGTH}
          rightMeta={`${title.length} / ${MAX_TITLE_LENGTH}`}
          placeholder={CATEGORY_METADATA[category].promptHint}
          helperText="A concise line naming what caught your attention."
          errorText={fieldErrors.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <TextareaField
          label="Field note"
          required
          maxLength={MAX_NOTE_LENGTH}
          rightMeta={`${note.length} / ${MAX_NOTE_LENGTH}`}
          placeholder="Describe the light, sound, texture, or fleeting moment in a few sentences..."
          helperText="Plain text only. Maximum 500 characters."
          errorText={fieldErrors.note}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <fieldset
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-3)',
            margin: 0,
          }}
        >
          <legend style={{ fontSize: 'var(--step--1)', fontWeight: 500, padding: '0 var(--space-1)' }}>
            Category
          </legend>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-1)',
              marginTop: 'var(--space-1)',
            }}
          >
            {ENTRY_CATEGORIES.map((cat) => {
              const selected = category === cat;
              return (
                <Button
                  key={cat}
                  type="button"
                  variant={selected ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={selected}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </Button>
              );
            })}
          </div>
          <p style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)', margin: 'var(--space-2) 0 0 0' }}>
            {CATEGORY_METADATA[category].description}
          </p>
        </fieldset>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 'var(--space-2)',
          }}
        >
          <InputField
            label="Observed date and time"
            type="datetime-local"
            required
            errorText={fieldErrors.observedAt}
            value={observedAtLocal}
            onChange={(e) => setObservedAtLocal(e.target.value)}
          />

          <InputField
            label="Place label (optional)"
            type="text"
            maxLength={MAX_PLACE_LABEL_LENGTH}
            rightMeta={`${placeLabel.length} / ${MAX_PLACE_LABEL_LENGTH}`}
            placeholder="e.g., East stairwell window"
            helperText="Manual text label only; no GPS coordinates are collected."
            errorText={fieldErrors.placeLabel}
            value={placeLabel}
            onChange={(e) => setPlaceLabel(e.target.value)}
          />
        </div>

        <div>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <InputField
                label="Tags (optional)"
                type="text"
                maxLength={MAX_TAG_LENGTH}
                rightMeta={`${tags.length} / ${MAX_TAGS_COUNT} tags`}
                placeholder="Type a tag and press Add (e.g., winter-light)"
                helperText={`Up to ${MAX_TAGS_COUNT} tags, max ${MAX_TAG_LENGTH} characters each.`}
                errorText={fieldErrors.tags}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={tags.length >= MAX_TAGS_COUNT || !tagDraft.trim()}
              onClick={handleAddTag}
              style={{ marginBottom: '1.65rem' }}
            >
              Add tag
            </Button>
          </div>

          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
              {tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  #{tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-2)',
            paddingTop: 'var(--space-2)',
            borderTop: '1px solid var(--line)',
          }}
        >
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={handleCancelClick}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {existingEntry ? 'Save changes' : 'Save observation'}
          </Button>
        </div>
      </form>

      <ModalDialog
        isOpen={showDiscardModal}
        title="Discard unsaved observation?"
        description="You have unsaved notes in the editor. Leaving now will discard these changes."
        onClose={() => setShowDiscardModal(false)}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button variant="secondary" onClick={() => setShowDiscardModal(false)}>
            Keep editing
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setShowDiscardModal(false);
              if (onCancel) {
                onCancel();
              } else {
                navigate('/app/journal');
              }
            }}
          >
            Discard changes
          </Button>
        </div>
      </ModalDialog>
    </>
  );
};

export const EntryEditorPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <p className="font-mono-meta" style={{ color: 'var(--accent-b)', margin: '0 0 var(--space-1) 0' }}>
          NEW FIELD ENTRY
        </p>
        <h1 className="heading-section display-gradient" style={{ margin: 0 }}>
          Record a small observation
        </h1>
      </header>
      <EntryEditorForm />
    </div>
  );
};
