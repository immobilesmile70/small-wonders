import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CURRENT_SCHEMA_VERSION,
  createEntrySchema,
  deleteAccountSchema,
  entryIdSchema,
  updateEntrySchema,
} from '../../schemas/entry';
import {
  createEntryViaApi,
  deleteAccountViaApi,
  deleteEntryViaApi,
  MutationClientError,
  updateEntryViaApi,
} from '../../services/api-client/mutations';
import {
  buildInsightsFromEntries,
  DEFAULT_PAGE_SIZE,
  fetchEntryByIdFromFirestore,
  fetchJournalInsightsFromFirestore,
  fetchPaginatedEntriesFromFirestore,
  paginateEntriesList,
} from '../../services/firestore-reads/entries';
import type {
  CreateEntryInput,
  EntryCategory,
  JournalEntry,
  JournalInsightsSummary,
  PaginatedEntriesResult,
  SortDirection,
  UpdateEntryInput,
} from '../../types/journal';
import { useAuth } from '../auth/AuthContext';

export interface JournalContextValue {
  entries: JournalEntry[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  nextCursor: string | null;
  selectedCategory: EntryCategory | 'All';
  sortDirection: SortDirection;
  searchQuery: string;
  insights: JournalInsightsSummary;
  setSelectedCategory: (cat: EntryCategory | 'All') => void;
  setSortDirection: (dir: SortDirection) => void;
  setSearchQuery: (q: string) => void;
  loadFirstPage: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  getEntryById: (entryId: string) => Promise<JournalEntry | null>;
  createEntry: (input: CreateEntryInput) => Promise<JournalEntry>;
  updateEntry: (entryId: string, input: UpdateEntryInput) => Promise<JournalEntry>;
  deleteEntry: (entryId: string) => Promise<void>;
  deleteAccountAndAllData: (confirmationText: string) => Promise<void>;
  exportUserJournalJson: () => string;
}

function getSandboxStorageKeyForUser(uid: string): string {
  return `sw_user_entries_v1_${uid}`;
}

function getDefaultStarterEntries(): JournalEntry[] {
  const now = Date.now();
  const hour = 3600 * 1000;
  const day = 24 * hour;

  return [
    {
      id: 'sw_starter_light_kitchen',
      title: 'The last rectangle of sunlight on the kitchen wall',
      note: 'At 4:42 PM the light comes through the narrow stairwell window and pauses on the lime-washed plaster beside the kettle for eleven minutes before vanishing behind the cedar tree.',
      category: 'Light',
      tags: ['afternoon', 'kitchen', 'winter-light'],
      observedAt: new Date(now - 5 * hour).toISOString(),
      placeLabel: 'East kitchen wall',
      createdAt: new Date(now - 5 * hour).toISOString(),
      updatedAt: new Date(now - 5 * hour).toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    {
      id: 'sw_starter_fern_paving',
      title: 'A tiny fern growing between two granite paving stones',
      note: 'Three fronds no wider than a postage stamp thriving in a millimeter of damp silt right where the morning commuters step over the curb.',
      category: 'Nature',
      tags: ['botany', 'sidewalk', 'moss'],
      observedAt: new Date(now - 1 * day - 3 * hour).toISOString(),
      placeLabel: 'Corner of Elm & 4th',
      createdAt: new Date(now - 1 * day - 3 * hour).toISOString(),
      updatedAt: new Date(now - 1 * day - 3 * hour).toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    {
      id: 'sw_starter_station_clock',
      title: 'The mechanical sigh the station clock makes before the hour',
      note: 'Five seconds before the minute hand jumps, there is a quiet brass intake of breath inside the housing that only people waiting on the north bench can hear.',
      category: 'Sound',
      tags: ['acoustics', 'clockwork', 'transit'],
      observedAt: new Date(now - 2 * day - 6 * hour).toISOString(),
      placeLabel: 'North platform bench',
      createdAt: new Date(now - 2 * day - 6 * hour).toISOString(),
      updatedAt: new Date(now - 2 * day - 6 * hour).toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    {
      id: 'sw_starter_brass_mailslot',
      title: 'Worn brass mail slot with eighty years of thumb polish',
      note: 'The dark patina has been rubbed back to pale gold only on the lower right corner where generations of carriers lifted the heavy flap.',
      category: 'Architecture',
      tags: ['brass', 'patina', 'doorway'],
      observedAt: new Date(now - 4 * day - 2 * hour).toISOString(),
      placeLabel: 'Old Post Office Arcade',
      createdAt: new Date(now - 4 * day - 2 * hour).toISOString(),
      updatedAt: new Date(now - 4 * day - 2 * hour).toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
  ];
}

function readSandboxEntries(uid: string): JournalEntry[] {
  try {
    const key = getSandboxStorageKeyForUser(uid);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const starter = getDefaultStarterEntries();
      window.localStorage.setItem(key, JSON.stringify(starter));
      return starter;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return getDefaultStarterEntries();
  }
}

function writeSandboxEntries(uid: string, entries: JournalEntry[]): void {
  try {
    window.localStorage.setItem(getSandboxStorageKeyForUser(uid), JSON.stringify(entries));
  } catch {
    // Ignore storage quota issues
  }
}

const JournalContext = createContext<JournalContextValue | null>(null);

export const JournalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isFirebaseConfigured, getIdToken, signOut } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [allSandboxEntries, setAllSandboxEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EntryCategory | 'All'>('All');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [insights, setInsights] = useState<JournalInsightsSummary>(() =>
    buildInsightsFromEntries([])
  );

  const refreshSandboxView = useCallback(
    (
      uid: string,
      category: EntryCategory | 'All',
      direction: SortDirection,
      cursor: string | null,
      append: boolean
    ) => {
      const stored = readSandboxEntries(uid);
      setAllSandboxEntries(stored);
      const page: PaginatedEntriesResult = paginateEntriesList({
        allEntries: stored,
        category,
        sortDirection: direction,
        cursorEntryId: cursor,
        pageSize: DEFAULT_PAGE_SIZE,
      });
      setEntries((prev) => (append ? [...prev, ...page.entries] : page.entries));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setInsights(buildInsightsFromEntries(stored));
    },
    []
  );

  const loadFirstPage = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setHasMore(false);
      setNextCursor(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isFirebaseConfigured) {
        const [pageResult, insightsResult] = await Promise.all([
          fetchPaginatedEntriesFromFirestore({
            uid: user.uid,
            category: selectedCategory,
            sortDirection,
            cursorEntryId: null,
            pageSize: DEFAULT_PAGE_SIZE,
          }),
          fetchJournalInsightsFromFirestore(user.uid),
        ]);
        setEntries(pageResult.entries);
        setNextCursor(pageResult.nextCursor);
        setHasMore(pageResult.hasMore);
        setInsights(insightsResult);
      } else {
        refreshSandboxView(user.uid, selectedCategory, sortDirection, null, false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load your journal entries right now.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user, isFirebaseConfigured, selectedCategory, sortDirection, refreshSandboxView]);

  const loadNextPage = useCallback(async () => {
    if (!user || !hasMore || !nextCursor || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      if (isFirebaseConfigured) {
        const pageResult = await fetchPaginatedEntriesFromFirestore({
          uid: user.uid,
          category: selectedCategory,
          sortDirection,
          cursorEntryId: nextCursor,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        setEntries((prev) => [...prev, ...pageResult.entries]);
        setNextCursor(pageResult.nextCursor);
        setHasMore(pageResult.hasMore);
      } else {
        refreshSandboxView(user.uid, selectedCategory, sortDirection, nextCursor, true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load the next page of observations.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    hasMore,
    nextCursor,
    isLoading,
    isFirebaseConfigured,
    selectedCategory,
    sortDirection,
    refreshSandboxView,
  ]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const getEntryById = useCallback(
    async (entryId: string): Promise<JournalEntry | null> => {
      if (!user) return null;
      const validId = entryIdSchema.safeParse(entryId);
      if (!validId.success) return null;

      if (isFirebaseConfigured) {
        return fetchEntryByIdFromFirestore(user.uid, validId.data);
      }
      const stored = readSandboxEntries(user.uid);
      return stored.find((e) => e.id === validId.data) || null;
    },
    [user, isFirebaseConfigured]
  );

  const createEntry = useCallback(
    async (input: CreateEntryInput): Promise<JournalEntry> => {
      if (!user) {
        throw new Error('You must be signed in to record an observation.');
      }
      if (!user.emailVerified) {
        throw new MutationClientError({
          statusCode: 403,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before saving journal entries.',
        });
      }

      // Run strict runtime validation before dispatching
      const parsed = createEntrySchema.safeParse(input);
      if (!parsed.success) {
        const flat = parsed.error.flatten();
        throw new MutationClientError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: flat.formErrors[0] || 'Please check the highlighted fields.',
          fieldErrors: flat.fieldErrors,
        });
      }

      if (isFirebaseConfigured) {
        const token = await getIdToken();
        const created = await createEntryViaApi(token, parsed.data);
        await loadFirstPage();
        return created;
      }

      const nowIso = new Date().toISOString();
      const created: JournalEntry = {
        id: `sw_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`,
        title: parsed.data.title,
        note: parsed.data.note,
        category: parsed.data.category,
        tags: parsed.data.tags,
        observedAt: parsed.data.observedAt,
        placeLabel: parsed.data.placeLabel ?? null,
        createdAt: nowIso,
        updatedAt: nowIso,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };
      const existing = readSandboxEntries(user.uid);
      const updatedList = [created, ...existing];
      writeSandboxEntries(user.uid, updatedList);
      refreshSandboxView(user.uid, selectedCategory, sortDirection, null, false);
      return created;
    },
    [
      user,
      isFirebaseConfigured,
      getIdToken,
      loadFirstPage,
      refreshSandboxView,
      selectedCategory,
      sortDirection,
    ]
  );

  const updateEntry = useCallback(
    async (entryId: string, input: UpdateEntryInput): Promise<JournalEntry> => {
      if (!user) {
        throw new Error('You must be signed in to update an observation.');
      }
      if (!user.emailVerified) {
        throw new MutationClientError({
          statusCode: 403,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before modifying journal entries.',
        });
      }

      const idCheck = entryIdSchema.safeParse(entryId);
      if (!idCheck.success) {
        throw new MutationClientError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid entry identifier.',
        });
      }

      const parsed = updateEntrySchema.safeParse(input);
      if (!parsed.success) {
        const flat = parsed.error.flatten();
        throw new MutationClientError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: flat.formErrors[0] || 'Please review the updated fields.',
          fieldErrors: flat.fieldErrors,
        });
      }

      if (isFirebaseConfigured) {
        const token = await getIdToken();
        const updated = await updateEntryViaApi(token, idCheck.data, parsed.data);
        await loadFirstPage();
        return updated;
      }

      const stored = readSandboxEntries(user.uid);
      const idx = stored.findIndex((item) => item.id === idCheck.data);
      if (idx === -1) {
        throw new MutationClientError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Observation not found in your journal.',
        });
      }

      const current = stored[idx];
      const updatedEntry: JournalEntry = {
        ...current,
        title: parsed.data.title ?? current.title,
        note: parsed.data.note ?? current.note,
        category: parsed.data.category ?? current.category,
        tags: parsed.data.tags ?? current.tags,
        observedAt: parsed.data.observedAt ?? current.observedAt,
        placeLabel:
          parsed.data.placeLabel !== undefined ? parsed.data.placeLabel : current.placeLabel,
        updatedAt: new Date().toISOString(),
      };

      const nextList = [...stored];
      nextList[idx] = updatedEntry;
      writeSandboxEntries(user.uid, nextList);
      refreshSandboxView(user.uid, selectedCategory, sortDirection, null, false);
      return updatedEntry;
    },
    [
      user,
      isFirebaseConfigured,
      getIdToken,
      loadFirstPage,
      refreshSandboxView,
      selectedCategory,
      sortDirection,
    ]
  );

  const deleteEntry = useCallback(
    async (entryId: string): Promise<void> => {
      if (!user) {
        throw new Error('You must be signed in to delete an observation.');
      }
      const idCheck = entryIdSchema.safeParse(entryId);
      if (!idCheck.success) {
        throw new MutationClientError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid entry identifier.',
        });
      }

      if (isFirebaseConfigured) {
        const token = await getIdToken();
        await deleteEntryViaApi(token, idCheck.data);
        await loadFirstPage();
        return;
      }

      const stored = readSandboxEntries(user.uid);
      const exists = stored.some((item) => item.id === idCheck.data);
      if (!exists) {
        throw new MutationClientError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Observation not found.',
        });
      }
      const nextList = stored.filter((item) => item.id !== idCheck.data);
      writeSandboxEntries(user.uid, nextList);
      refreshSandboxView(user.uid, selectedCategory, sortDirection, null, false);
    },
    [
      user,
      isFirebaseConfigured,
      getIdToken,
      loadFirstPage,
      refreshSandboxView,
      selectedCategory,
      sortDirection,
    ]
  );

  const deleteAccountAndAllData = useCallback(
    async (confirmationText: string): Promise<void> => {
      if (!user) {
        throw new Error('You must be signed in to delete your account.');
      }

      const confirmParsed = deleteAccountSchema.safeParse({ confirmationText });
      if (!confirmParsed.success) {
        const flat = confirmParsed.error.flatten();
        throw new MutationClientError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message:
            flat.fieldErrors.confirmationText?.[0] ||
            'Please type DELETE MY JOURNAL to confirm account removal.',
          fieldErrors: flat.fieldErrors,
        });
      }

      if (isFirebaseConfigured) {
        const token = await getIdToken();
        await deleteAccountViaApi(token, confirmParsed.data.confirmationText);
        await signOut();
        return;
      }

      try {
        window.localStorage.removeItem(getSandboxStorageKeyForUser(user.uid));
      } catch {
        // Ignore storage error
      }
      await signOut();
    },
    [user, isFirebaseConfigured, getIdToken, signOut]
  );

  const exportUserJournalJson = useCallback((): string => {
    const sourceEntries = isFirebaseConfigured ? entries : allSandboxEntries;
    return JSON.stringify(
      {
        application: 'Small Wonders Field Journal',
        exportedAt: new Date().toISOString(),
        ownerEmail: user?.email || null,
        entryCount: sourceEntries.length,
        entries: sourceEntries,
      },
      null,
      2
    );
  }, [isFirebaseConfigured, entries, allSandboxEntries, user]);

  const value = useMemo<JournalContextValue>(
    () => ({
      entries,
      isLoading,
      error,
      hasMore,
      nextCursor,
      selectedCategory,
      sortDirection,
      searchQuery,
      insights,
      setSelectedCategory,
      setSortDirection,
      setSearchQuery,
      loadFirstPage,
      loadNextPage,
      getEntryById,
      createEntry,
      updateEntry,
      deleteEntry,
      deleteAccountAndAllData,
      exportUserJournalJson,
    }),
    [
      entries,
      isLoading,
      error,
      hasMore,
      nextCursor,
      selectedCategory,
      sortDirection,
      searchQuery,
      insights,
      loadFirstPage,
      loadNextPage,
      getEntryById,
      createEntry,
      updateEntry,
      deleteEntry,
      deleteAccountAndAllData,
      exportUserJournalJson,
    ]
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
};

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error('useJournal must be used within a JournalProvider.');
  }
  return ctx;
}
