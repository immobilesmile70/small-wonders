import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createEntrySchema,
  deleteAccountSchema,
  entryIdSchema,
  isValidCategory,
  isValidObservedAtTimestamp,
  MAX_NOTE_LENGTH,
  MAX_PLACE_LABEL_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS_COUNT,
  MAX_TITLE_LENGTH,
  normalizeSingleTag,
  normalizeTagsList,
  updateEntrySchema,
} from '../../src/schemas/entry';
import { mapApiErrorToUserMessage } from '../../src/services/api-client/mutations';
import { mapFirebaseAuthError } from '../../src/features/auth/AuthContext';
import {
  buildInsightsFromEntries,
  filterLoadedEntriesBySearch,
  paginateEntriesList,
} from '../../src/services/firestore-reads/entries';
import type { JournalEntry } from '../../src/types/journal';

test('Tag normalization trims, lowercases, strips leading #, and deduplicates', () => {
  assert.equal(normalizeSingleTag('  #Winter-Light  '), 'winter-light');
  assert.equal(normalizeSingleTag('###Botany   Notes'), 'botany notes');

  const deduped = normalizeTagsList(['#Moss', 'moss', '  MOSS  ', 'Paving-Stone']);
  assert.deepEqual(deduped, ['moss', 'paving-stone']);
});

test('Input length constraints enforce maximums for title, note, tags, and placeLabel', () => {
  const validNow = new Date().toISOString();

  const validResult = createEntrySchema.safeParse({
    title: 'The last rectangle of sunlight on the kitchen floor',
    note: 'Warm light resting across the terracotta tiles at 4:40 PM.',
    category: 'Light',
    tags: ['Afternoon', '#Kitchen', 'afternoon'],
    observedAt: validNow,
    placeLabel: '  East kitchen doorway  ',
  });
  assert.equal(validResult.success, true);
  if (validResult.success) {
    assert.deepEqual(validResult.data.tags, ['afternoon', 'kitchen']);
    assert.equal(validResult.data.placeLabel, 'East kitchen doorway');
  }

  const longTitle = createEntrySchema.safeParse({
    title: 'A'.repeat(MAX_TITLE_LENGTH + 1),
    note: 'Valid note',
    category: 'Light',
    observedAt: validNow,
  });
  assert.equal(longTitle.success, false);

  const longNote = createEntrySchema.safeParse({
    title: 'Valid title',
    note: 'N'.repeat(MAX_NOTE_LENGTH + 1),
    category: 'Nature',
    observedAt: validNow,
  });
  assert.equal(longNote.success, false);

  const tooManyTags = createEntrySchema.safeParse({
    title: 'Valid title',
    note: 'Valid note',
    category: 'Sound',
    tags: ['t1', 't2', 't3', 't4', 't5', 't6'],
    observedAt: validNow,
  });
  assert.equal(tooManyTags.success, false);

  const longTag = createEntrySchema.safeParse({
    title: 'Valid title',
    note: 'Valid note',
    category: 'Sound',
    tags: ['a'.repeat(MAX_TAG_LENGTH + 1)],
    observedAt: validNow,
  });
  assert.equal(longTag.success, false);

  const longPlace = createEntrySchema.safeParse({
    title: 'Valid title',
    note: 'Valid note',
    category: 'Architecture',
    observedAt: validNow,
    placeLabel: 'P'.repeat(MAX_PLACE_LABEL_LENGTH + 1),
  });
  assert.equal(longPlace.success, false);
});

test('Category validation accepts only the 6 supported categories', () => {
  assert.equal(isValidCategory('Nature'), true);
  assert.equal(isValidCategory('Light'), true);
  assert.equal(isValidCategory('Architecture'), true);
  assert.equal(isValidCategory('People'), true);
  assert.equal(isValidCategory('Sound'), true);
  assert.equal(isValidCategory('Unexpected'), true);
  assert.equal(isValidCategory('Productivity'), false);
  assert.equal(isValidCategory(''), false);
});

test('Timestamp parsing rejects invalid strings, pre-1970 dates, and far-future dates', () => {
  assert.equal(isValidObservedAtTimestamp(new Date().toISOString()), true);
  assert.equal(isValidObservedAtTimestamp('not-a-timestamp'), false);
  assert.equal(isValidObservedAtTimestamp('1965-05-01T00:00:00.000Z'), false);
  const farFuture = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  assert.equal(isValidObservedAtTimestamp(farFuture), false);
});

test('Strict object schemas reject unknown properties and client ownership spoofing', () => {
  const spoofAttempt = createEntrySchema.safeParse({
    title: 'Valid title',
    note: 'Valid note',
    category: 'Light',
    observedAt: new Date().toISOString(),
    uid: 'spoofed-other-user-uid',
    createdAt: '2020-01-01T00:00:00.000Z',
    isAdmin: true,
  });
  assert.equal(spoofAttempt.success, false);

  const emptyUpdate = updateEntrySchema.safeParse({});
  assert.equal(emptyUpdate.success, false);

  const malformedId = entryIdSchema.safeParse('../users/other/entries/123');
  assert.equal(malformedId.success, false);

  const validId = entryIdSchema.safeParse('sw_aBcDeFgHiJkLmNoPqR12');
  assert.equal(validId.success, true);

  const wrongDeleteConfirm = deleteAccountSchema.safeParse({
    confirmationText: 'delete my journal',
  });
  assert.equal(wrongDeleteConfirm.success, false);

  const validDeleteConfirm = deleteAccountSchema.safeParse({
    confirmationText: 'DELETE MY JOURNAL',
  });
  assert.equal(validDeleteConfirm.success, true);
});

test('API and Auth error mapping returns safe, human-readable messages', () => {
  assert.match(
    mapApiErrorToUserMessage('RATE_LIMITED', 'Slow down', 45),
    /wait 45 seconds/i
  );
  assert.match(
    mapApiErrorToUserMessage('EMAIL_NOT_VERIFIED', ''),
    /verify your email/i
  );
  assert.match(
    mapFirebaseAuthError({ code: 'auth/invalid-credential' }),
    /No account matched/i
  );
});

test('Cursor-based pagination and search operate deterministically without duplicates', () => {
  const sampleEntries: JournalEntry[] = Array.from({ length: 12 }).map((_, i) => ({
    id: `sw_entry_num_${String(i + 1).padStart(2, '0')}`,
    title: `Observation ${i + 1}`,
    note: i % 2 === 0 ? 'Afternoon sunlight on stone' : 'Rain on metal roof',
    category: i % 2 === 0 ? 'Light' : 'Sound',
    tags: i % 2 === 0 ? ['sunlight'] : ['rain'],
    observedAt: new Date(Date.UTC(2026, 9, i + 1, 12, 0, 0)).toISOString(),
    placeLabel: 'Courtyard',
    createdAt: new Date(Date.UTC(2026, 9, i + 1, 12, 0, 0)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, i + 1, 12, 0, 0)).toISOString(),
    schemaVersion: 1,
  }));

  const page1 = paginateEntriesList({
    allEntries: sampleEntries,
    category: 'All',
    sortDirection: 'desc',
    cursorEntryId: null,
    pageSize: 5,
  });
  assert.equal(page1.entries.length, 5);
  assert.equal(page1.hasMore, true);
  assert.equal(page1.entries[0].id, 'sw_entry_num_12');
  assert.equal(page1.nextCursor, 'sw_entry_num_08');

  const page2 = paginateEntriesList({
    allEntries: sampleEntries,
    category: 'All',
    sortDirection: 'desc',
    cursorEntryId: page1.nextCursor,
    pageSize: 5,
  });
  assert.equal(page2.entries.length, 5);
  assert.equal(page2.entries[0].id, 'sw_entry_num_07');
  assert.equal(page2.hasMore, true);

  const page3 = paginateEntriesList({
    allEntries: sampleEntries,
    category: 'All',
    sortDirection: 'desc',
    cursorEntryId: page2.nextCursor,
    pageSize: 5,
  });
  assert.equal(page3.entries.length, 2);
  assert.equal(page3.hasMore, false);
  assert.equal(page3.nextCursor, null);

  const searched = filterLoadedEntriesBySearch(page1.entries, 'rain');
  assert.equal(searched.every((e) => e.category === 'Sound'), true);

  const insights = buildInsightsFromEntries(
    sampleEntries,
    new Date(Date.UTC(2026, 9, 12, 18, 0, 0))
  );
  assert.equal(insights.totalEntriesInSample, 12);
  assert.equal(insights.entriesLastSevenDays, 7);
});

test('Pre-Flight Discipline: Zero em-dashes in UI pages and zero client-side Firestore write calls', () => {
  const srcDirs = [
    'src',
    'src/types',
    'src/lib',
    'src/schemas',
    'src/services/firebase',
    'src/services/api-client',
    'src/services/firestore-reads',
    'src/features/auth',
    'src/features/journal',
    'src/components/ui',
    'src/components/three',
    'src/components/layout',
    'src/pages/public',
    'src/pages/auth',
    'src/pages/app',
    'src/app',
  ];

  const files: string[] = [];
  for (const relDir of srcDirs) {
    const fullDir = path.resolve(process.cwd(), relDir);
    if (!fs.existsSync(fullDir)) continue;
    for (const name of fs.readdirSync(fullDir)) {
      if (name.endsWith('.ts') || name.endsWith('.tsx')) {
        files.push(path.join(fullDir, name));
      }
    }
  }

  assert.equal(files.length >= 20, true, `Expected >= 20 src files, found ${files.length}`);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(
      content.includes('—'),
      false,
      `Found forbidden em-dash (—) in ${path.relative(process.cwd(), file)}`
    );
    assert.equal(
      content.includes('–'),
      false,
      `Found forbidden en-dash (–) in ${path.relative(process.cwd(), file)}`
    );
    assert.equal(
      /\b(addDoc|setDoc|updateDoc|deleteDoc)\b/.test(content),
      false,
      `Found forbidden client-side Firestore write primitive in ${path.relative(process.cwd(), file)}`
    );
  }
});
