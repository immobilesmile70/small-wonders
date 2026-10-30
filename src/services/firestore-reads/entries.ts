import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { DAILY_OBSERVATION_PROMPTS } from '../../lib/designSystem';
import { isValidCategory } from '../../schemas/entry';
import {
  ENTRY_CATEGORIES,
  type EntryCategory,
  type JournalEntry,
  type JournalInsightsSummary,
  type PaginatedEntriesResult,
  type SortDirection,
} from '../../types/journal';
import { getFirebaseClientServices } from '../firebase/client';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 25;
export const INSIGHTS_SAMPLE_LIMIT = 45;

/**
 * Normalizes a raw Firestore document snapshot into a typed `JournalEntry`.
 * Handles missing optional fields, tag normalization, and Firestore Timestamp conversion safely.
 */
export function normalizeFirestoreEntryDoc(
  id: string,
  data: Record<string, unknown>
): JournalEntry {
  const toIso = (val: unknown, fallbackIso: string): string => {
    if (!val) return fallbackIso;
    if (typeof val === 'string') {
      const parsed = Date.parse(val);
      return Number.isNaN(parsed) ? fallbackIso : new Date(parsed).toISOString();
    }
    if (
      typeof val === 'object' &&
      val !== null &&
      'toDate' in val &&
      typeof (val as { toDate: () => Date }).toDate === 'function'
    ) {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    return fallbackIso;
  };

  const nowIso = new Date().toISOString();
  const observedAt = toIso(data.observedAt, nowIso);
  const createdAt = toIso(data.createdAt, observedAt);
  const updatedAt = toIso(data.updatedAt, createdAt);

  const category: EntryCategory = isValidCategory(data.category)
    ? data.category
    : 'Unexpected';

  const rawTags = Array.isArray(data.tags) ? data.tags : [];
  const tags = rawTags
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .slice(0, 5)
    .map((t) => t.trim().toLowerCase());

  const placeLabel =
    typeof data.placeLabel === 'string' && data.placeLabel.trim().length > 0
      ? data.placeLabel.trim().slice(0, 80)
      : null;

  return {
    id,
    title: typeof data.title === 'string' ? data.title.slice(0, 80) : 'Untitled observation',
    note: typeof data.note === 'string' ? data.note.slice(0, 500) : '',
    category,
    tags,
    observedAt,
    placeLabel,
    createdAt,
    updatedAt,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 1,
  };
}

/**
 * Pure cursor-based pagination helper over an ordered list of entries,
 * used both for testing pagination stability and local sandbox evaluation.
 */
export function paginateEntriesList(params: {
  allEntries: JournalEntry[];
  category?: EntryCategory | 'All';
  sortDirection?: SortDirection;
  cursorEntryId?: string | null;
  pageSize?: number;
}): PaginatedEntriesResult {
  const {
    allEntries,
    category = 'All',
    sortDirection = 'desc',
    cursorEntryId = null,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params;

  const boundedPageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

  const filtered =
    category === 'All'
      ? [...allEntries]
      : allEntries.filter((entry) => entry.category === category);

  filtered.sort((a, b) => {
    const timeDiff = Date.parse(a.observedAt) - Date.parse(b.observedAt);
    if (timeDiff !== 0) {
      return sortDirection === 'desc' ? -timeDiff : timeDiff;
    }
    return sortDirection === 'desc'
      ? b.id.localeCompare(a.id)
      : a.id.localeCompare(b.id);
  });

  let startIndex = 0;
  if (cursorEntryId) {
    const cursorIdx = filtered.findIndex((item) => item.id === cursorEntryId);
    if (cursorIdx !== -1) {
      startIndex = cursorIdx + 1;
    }
  }

  const slice = filtered.slice(startIndex, startIndex + boundedPageSize + 1);
  const hasMore = slice.length > boundedPageSize;
  const pageEntries = hasMore ? slice.slice(0, boundedPageSize) : slice;
  const nextCursor =
    hasMore && pageEntries.length > 0 ? pageEntries[pageEntries.length - 1].id : null;

  return {
    entries: pageEntries,
    nextCursor,
    hasMore,
    totalLoaded: pageEntries.length,
  };
}

/**
 * Filter loaded entries by search query (title, note, tags, placeLabel).
 * Explicitly operates on the loaded archive slice without downloading unbounded collections.
 */
export function filterLoadedEntriesBySearch(
  entries: JournalEntry[],
  searchQuery: string
): JournalEntry[] {
  const trimmed = searchQuery.trim().toLowerCase();
  if (!trimmed) {
    return entries;
  }
  return entries.filter((entry) => {
    if (entry.title.toLowerCase().includes(trimmed)) return true;
    if (entry.note.toLowerCase().includes(trimmed)) return true;
    if (entry.placeLabel && entry.placeLabel.toLowerCase().includes(trimmed)) return true;
    return entry.tags.some((tag) => tag.toLowerCase().includes(trimmed));
  });
}

/**
 * Direct, authorized read of a single journal entry from `users/{uid}/entries/{entryId}`.
 */
export async function fetchEntryByIdFromFirestore(
  uid: string,
  entryId: string
): Promise<JournalEntry | null> {
  if (!uid || !entryId) return null;
  const { db } = getFirebaseClientServices();
  const entryRef = doc(db, 'users', uid, 'entries', entryId);
  const snap = await getDoc(entryRef);
  if (!snap.exists()) {
    return null;
  }
  return normalizeFirestoreEntryDoc(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Direct, authorized, bounded cursor-paginated query against `users/{uid}/entries`.
 * Enforces a maximum page size of 25 (well within the Firestore rule cap of 50).
 */
export async function fetchPaginatedEntriesFromFirestore(params: {
  uid: string;
  category?: EntryCategory | 'All';
  sortDirection?: SortDirection;
  cursorEntryId?: string | null;
  pageSize?: number;
}): Promise<PaginatedEntriesResult> {
  const {
    uid,
    category = 'All',
    sortDirection = 'desc',
    cursorEntryId = null,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params;

  const boundedSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const { db } = getFirebaseClientServices();
  const entriesRef = collection(db, 'users', uid, 'entries');

  const constraints: QueryConstraint[] = [];
  if (category !== 'All') {
    constraints.push(where('category', '==', category));
  }
  constraints.push(orderBy('observedAt', sortDirection));

  if (cursorEntryId) {
    const cursorRef = doc(db, 'users', uid, 'entries', cursorEntryId);
    const cursorSnap = await getDoc(cursorRef);
    if (cursorSnap.exists()) {
      constraints.push(startAfter(cursorSnap));
    }
  }

  // Request boundedSize + 1 to detect whether a next page exists (max 26 <= 50 rule limit)
  constraints.push(limit(boundedSize + 1));

  const q = query(entriesRef, ...constraints);
  const snapshot = await getDocs(q);

  const docs = snapshot.docs.map((d) =>
    normalizeFirestoreEntryDoc(d.id, d.data() as Record<string, unknown>)
  );

  const hasMore = docs.length > boundedSize;
  const entries = hasMore ? docs.slice(0, boundedSize) : docs;
  const nextCursor = hasMore && entries.length > 0 ? entries[entries.length - 1].id : null;

  return {
    entries,
    nextCursor,
    hasMore,
    totalLoaded: entries.length,
  };
}

/**
 * Computes transparent, grounded personal insights from a bounded sample of recent entries.
 * Never invents counts or claims personality analysis.
 */
export function buildInsightsFromEntries(
  entries: JournalEntry[],
  referenceDate: Date = new Date()
): JournalInsightsSummary {
  const sevenDaysAgoMs = referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000;
  const entriesLastSevenDays = entries.filter(
    (e) => Date.parse(e.observedAt) >= sevenDaysAgoMs
  ).length;

  const categoryCounts = new Map<EntryCategory, number>();
  for (const cat of ENTRY_CATEGORIES) {
    categoryCounts.set(cat, 0);
  }

  const tagCounts = new Map<string, number>();

  for (const entry of entries) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const total = entries.length;
  const categoryDistribution = ENTRY_CATEGORIES.map((category) => {
    const count = categoryCounts.get(category) || 0;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return { category, count, percentage };
  }).sort((a, b) => b.count - a.count);

  const topCategory =
    total > 0 && categoryDistribution[0].count > 0 ? categoryDistribution[0].category : null;

  const recentTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 8);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyActivity: JournalInsightsSummary['dailyActivity'] = [];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(referenceDate.getTime() - offset * 24 * 60 * 60 * 1000);
    const dateIso = d.toISOString().slice(0, 10);
    const dayLabel = dayNames[d.getDay()];
    const count = entries.filter((e) => e.observedAt.slice(0, 10) === dateIso).length;
    dailyActivity.push({ dateIso, dayLabel, count });
  }

  let reflectionPrompt = DAILY_OBSERVATION_PROMPTS[0];
  if (topCategory === 'Light') {
    reflectionPrompt =
      'You have been noticing light often lately. Next time you step outside, listen for one quiet sound before looking up.';
  } else if (topCategory === 'Nature') {
    reflectionPrompt =
      'Your recent notes lean toward the natural world. Today, look for one small architectural detail shaped by human hands.';
  } else if (topCategory === 'Architecture') {
    reflectionPrompt =
      'You have an eye for built forms. Notice how afternoon shadow or weather changes one familiar building today.';
  } else if (topCategory === 'Sound') {
    reflectionPrompt =
      'You have been attentive to sound. Pause this afternoon to record one silent visual detail in the room around you.';
  }

  return {
    reportingWindowDays: 7,
    reportingPeriodLabel: `Last 7 days and up to ${INSIGHTS_SAMPLE_LIMIT} recent entries`,
    entriesLastSevenDays,
    totalEntriesInSample: total,
    categoryDistribution,
    topCategory,
    recentTags,
    dailyActivity,
    reflectionPrompt,
  };
}

export async function fetchJournalInsightsFromFirestore(
  uid: string
): Promise<JournalInsightsSummary> {
  const result = await fetchPaginatedEntriesFromFirestore({
    uid,
    sortDirection: 'desc',
    pageSize: MAX_PAGE_SIZE,
  });
  return buildInsightsFromEntries(result.entries);
}
