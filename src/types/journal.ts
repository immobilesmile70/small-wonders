export const ENTRY_CATEGORIES = [
  'Nature',
  'Light',
  'Architecture',
  'People',
  'Sound',
  'Unexpected',
] as const;

export type EntryCategory = (typeof ENTRY_CATEGORIES)[number];

export interface JournalEntry {
  id: string;
  title: string;
  note: string;
  category: EntryCategory;
  tags: string[];
  observedAt: string; // ISO-8601 string in UI / converted from Firestore Timestamp on read
  placeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface CreateEntryInput {
  title: string;
  note: string;
  category: EntryCategory;
  tags?: string[];
  observedAt: string;
  placeLabel?: string | null;
}

export interface UpdateEntryInput {
  title?: string;
  note?: string;
  category?: EntryCategory;
  tags?: string[];
  observedAt?: string;
  placeLabel?: string | null;
}

export type SortDirection = 'desc' | 'asc';

export interface JournalQueryFilters {
  category: EntryCategory | 'All';
  sortDirection: SortDirection;
  searchQuery: string;
  pageSize: number;
}

export interface PaginatedEntriesResult {
  entries: JournalEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  totalLoaded: number;
}

export interface JournalInsightsSummary {
  reportingWindowDays: number;
  reportingPeriodLabel: string;
  entriesLastSevenDays: number;
  totalEntriesInSample: number;
  categoryDistribution: Array<{
    category: EntryCategory;
    count: number;
    percentage: number;
  }>;
  topCategory: EntryCategory | null;
  recentTags: Array<{
    tag: string;
    count: number;
  }>;
  dailyActivity: Array<{
    dateIso: string;
    dayLabel: string;
    count: number;
  }>;
  reflectionPrompt: string;
}

export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code:
      | 'BAD_REQUEST'
      | 'VALIDATION_ERROR'
      | 'UNAUTHORIZED'
      | 'EMAIL_NOT_VERIFIED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'METHOD_NOT_ALLOWED'
      | 'PAYLOAD_TOO_LARGE'
      | 'UNSUPPORTED_MEDIA_TYPE'
      | 'RATE_LIMITED'
      | 'SERVICE_UNAVAILABLE'
      | 'INTERNAL_ERROR';
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
}
