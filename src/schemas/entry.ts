import { z } from '../lib/z';
import { ENTRY_CATEGORIES, type EntryCategory } from '../types/journal';

export const MAX_TITLE_LENGTH = 80;
export const MAX_NOTE_LENGTH = 500;
export const MAX_TAGS_COUNT = 5;
export const MAX_TAG_LENGTH = 24;
export const MAX_PLACE_LABEL_LENGTH = 80;
export const MAX_REQUEST_BODY_BYTES = 16 * 1024; // 16 KB hard limit
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Normalizes a single tag:
 * - trims leading/trailing whitespace
 * - collapses internal whitespace to a single hyphen or space
 * - strips leading '#' if user typed a hashtag
 * - converts to lowercase for consistent indexing and deduplication
 */
export function normalizeSingleTag(rawTag: string): string {
  return rawTag
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalizes and deduplicates an array of tags while preserving order.
 */
export function normalizeTagsList(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawTags) {
    if (typeof raw !== 'string') continue;
    const normalized = normalizeSingleTag(raw);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

/**
 * Validates that a timestamp string represents a real calendar time
 * between 1970-01-01 and at most 24 hours in the future (allowing for local timezone skew).
 */
export function isValidObservedAtTimestamp(value: string): boolean {
  if (typeof value !== 'string' || value.trim().length < 10 || value.length > 64) {
    return false;
  }
  const parsedMs = Date.parse(value);
  if (Number.isNaN(parsedMs)) {
    return false;
  }
  const minAllowedMs = Date.UTC(1970, 0, 1, 0, 0, 0);
  const maxAllowedMs = Date.now() + 24 * 60 * 60 * 1000; // +24h tolerance
  return parsedMs >= minAllowedMs && parsedMs <= maxAllowedMs;
}

export function parseObservedAtToIso(value: string): string {
  const parsedMs = Date.parse(value);
  if (Number.isNaN(parsedMs)) {
    throw new Error('Invalid observation timestamp.');
  }
  return new Date(parsedMs).toISOString();
}

export const entryIdSchema = z
  .string()
  .trim()
  .min(10, 'Entry identifier must be at least 10 characters.')
  .max(48, 'Entry identifier cannot exceed 48 characters.')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Entry identifier contains invalid characters. Only alphanumeric, hyphen, and underscore are permitted.'
  );

export const categorySchema = z.enum(ENTRY_CATEGORIES);

export const tagItemSchema = z
  .string()
  .trim()
  .transform(normalizeSingleTag)
  .refine((val) => val.length >= 1, 'Tag cannot be empty.')
  .refine(
    (val) => val.length <= MAX_TAG_LENGTH,
    `Each tag must be at most ${MAX_TAG_LENGTH} characters.`
  )
  .refine(
    (val) => /^[a-z0-9][a-z0-9 -]*$/i.test(val),
    'Tags may only contain letters, numbers, spaces, and hyphens.'
  );

export const tagsArraySchema = z
  .array(tagItemSchema)
  .max(MAX_TAGS_COUNT, `You can add at most ${MAX_TAGS_COUNT} tags per observation.`)
  .default([])
  .transform((tags) => {
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const t of tags) {
      if (!seen.has(t)) {
        seen.add(t);
        deduped.push(t);
      }
    }
    return deduped;
  });

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Give your observation a short title.')
  .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`)
  .transform((val) => val.replace(/\s+/g, ' '));

export const noteSchema = z
  .string()
  .trim()
  .min(1, 'Write a few words describing what you noticed.')
  .max(MAX_NOTE_LENGTH, `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`);

export const observedAtSchema = z
  .string()
  .trim()
  .refine(
    isValidObservedAtTimestamp,
    'Observation date must be a valid timestamp between 1970 and today.'
  )
  .transform(parseObservedAtToIso);

export const placeLabelSchema = z
  .string()
  .trim()
  .max(MAX_PLACE_LABEL_LENGTH, `Place label must be ${MAX_PLACE_LABEL_LENGTH} characters or fewer.`)
  .transform((val) => {
    const collapsed = val.replace(/\s+/g, ' ').trim();
    return collapsed.length > 0 ? collapsed : null;
  })
  .nullable()
  .optional();

/**
 * Schema for POST /api/entries
 * Uses `.strict()` to reject any unexpected or administrative fields (`uid`, `createdAt`, `updatedAt`, `schemaVersion`, etc.).
 */
export const createEntrySchema = z
  .object({
    title: titleSchema,
    note: noteSchema,
    category: categorySchema,
    tags: tagsArraySchema,
    observedAt: observedAtSchema,
    placeLabel: placeLabelSchema,
  })
  .strict();

/**
 * Schema for PATCH /api/entries/:entryId
 * Requires at least one recognized mutable field and rejects unknown properties.
 */
export const updateEntrySchema = z
  .object({
    title: titleSchema.optional(),
    note: noteSchema.optional(),
    category: categorySchema.optional(),
    tags: z
      .array(tagItemSchema)
      .max(MAX_TAGS_COUNT, `You can add at most ${MAX_TAGS_COUNT} tags per observation.`)
      .transform(normalizeTagsList)
      .optional(),
    observedAt: observedAtSchema.optional(),
    placeLabel: placeLabelSchema,
  })
  .strict()
  .refine(
    (data) =>
      data.title !== undefined ||
      data.note !== undefined ||
      data.category !== undefined ||
      data.tags !== undefined ||
      data.observedAt !== undefined ||
      data.placeLabel !== undefined,
    'At least one field must be provided when updating an observation.'
  );

/**
 * Schema for DELETE /api/account
 * Requires explicit confirmation string `"DELETE MY JOURNAL"` to prevent accidental deletion.
 */
export const deleteAccountSchema = z
  .object({
    confirmationText: z
      .string()
      .trim()
      .refine(
        (val) => val === 'DELETE MY JOURNAL',
        'Please type DELETE MY JOURNAL to confirm permanent account removal.'
      ),
  })
  .strict();

export function isValidCategory(value: unknown): value is EntryCategory {
  return typeof value === 'string' && (ENTRY_CATEGORIES as readonly string[]).includes(value);
}
