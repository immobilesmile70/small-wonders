import test from 'node:test';
import assert from 'node:assert/strict';
import entriesHandler from '../../api/entries/index';
import entryByIdHandler from '../../api/entries/[entryId]';
import accountHandler from '../../api/account';
import {
  setAdminBackendAdapterForTesting,
  type AdminBackendAdapter,
  type AdminEntryDoc,
  type DecodedAuthToken,
} from '../../api/_lib/firebaseAdmin';
import { setRateLimitStoreForTesting, type RateLimitStore } from '../../api/_lib/rateLimit';
import type { VercelRequestLike, VercelResponseLike } from '../../api/_lib/security';
import type { JournalEntry } from '../../src/types/journal';

process.env.SILENCE_API_LOGS = 'true';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173,https://small-wonders.vercel.app';
process.env.ENFORCE_APP_CHECK = 'false';
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

function createMockRes(): VercelResponseLike & {
  statusCode: number;
  headers: Record<string, string>;
  jsonBody: any;
  ended: boolean;
} {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    jsonBody: null as any,
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      this.ended = true;
    },
    end() {
      this.ended = true;
    },
  };
  return res;
}

function setupTestEnvironment(options?: {
  rateLimitAllowed?: boolean;
  firestoreThrows?: boolean;
}) {
  const dbStore = new Map<string, Map<string, JournalEntry>>();

  const mockAdapter: AdminBackendAdapter = {
    async verifyIdToken(token: string): Promise<DecodedAuthToken> {
      if (token === 'valid_token_alice_verified') {
        return {
          uid: 'uid_alice',
          email: 'alice@example.com',
          email_verified: true,
          firebase: { sign_in_provider: 'password' },
        };
      }
      if (token === 'valid_token_bob_verified') {
        return {
          uid: 'uid_bob',
          email: 'bob@example.com',
          email_verified: true,
          firebase: { sign_in_provider: 'password' },
        };
      }
      if (token === 'valid_token_unverified_user') {
        return {
          uid: 'uid_unverified',
          email: 'unverified@example.com',
          email_verified: false,
          firebase: { sign_in_provider: 'password' },
        };
      }
      throw new Error('Firebase ID token has expired or is invalid.');
    },
    async verifyAppCheckToken(token: string) {
      if (token === 'valid_app_check_token') {
        return { appId: '1:000:web:abc' };
      }
      throw new Error('Invalid App Check token');
    },
    async createEntry(uid: string, entryId: string, data: AdminEntryDoc): Promise<JournalEntry> {
      if (options?.firestoreThrows) {
        throw new Error('INTERNAL_FIRESTORE_CONNECTION_CREDENTIALS_SECRET_PATH_ERROR');
      }
      if (!dbStore.has(uid)) {
        dbStore.set(uid, new Map());
      }
      const entry: JournalEntry = { id: entryId, ...data };
      dbStore.get(uid)!.set(entryId, entry);
      return entry;
    },
    async updateEntry(uid, entryId, updates): Promise<JournalEntry | null> {
      if (options?.firestoreThrows) {
        throw new Error('INTERNAL_FIRESTORE_FAILURE');
      }
      const userMap = dbStore.get(uid);
      if (!userMap || !userMap.has(entryId)) {
        return null;
      }
      const existing = userMap.get(entryId)!;
      const updated: JournalEntry = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      userMap.set(entryId, updated);
      return updated;
    },
    async deleteEntry(uid: string, entryId: string): Promise<boolean> {
      const userMap = dbStore.get(uid);
      if (!userMap || !userMap.has(entryId)) {
        return false;
      }
      userMap.delete(entryId);
      return true;
    },
    async deleteUserAccountAndData(uid: string): Promise<{ deletedEntriesCount: number }> {
      const userMap = dbStore.get(uid);
      const count = userMap ? userMap.size : 0;
      dbStore.delete(uid);
      return { deletedEntriesCount: count };
    },
  };

  const mockRateLimitStore: RateLimitStore = {
    async incrementAndCheck(_key, limit) {
      const allowed = options?.rateLimitAllowed ?? true;
      return {
        allowed,
        limit,
        remaining: allowed ? limit - 1 : 0,
        resetEpochSeconds: Math.floor(Date.now() / 1000) + 60,
        retryAfterSeconds: 42,
      };
    },
  };

  setAdminBackendAdapterForTesting(mockAdapter);
  setRateLimitStoreForTesting(mockRateLimitStore);

  return { dbStore };
}

test('API Security: Rejects unsupported HTTP methods with 405 and Allow header', async () => {
  setupTestEnvironment();
  const req: VercelRequestLike = {
    method: 'GET',
    headers: {},
  };
  const res = createMockRes();
  await entriesHandler(req, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['allow'], 'POST, OPTIONS');
  assert.equal(res.jsonBody.ok, false);
  assert.equal(res.jsonBody.error.code, 'METHOD_NOT_ALLOWED');
});

test('API Security: Rejects missing, malformed, and expired Authorization headers with 401', async () => {
  setupTestEnvironment();
  const validPayload = {
    title: 'Afternoon light',
    note: 'Sunlight on the wall.',
    category: 'Light',
    observedAt: new Date().toISOString(),
  };

  // 1. Missing Authorization header
  const resMissing = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: validPayload,
    },
    resMissing
  );
  assert.equal(resMissing.statusCode, 401);

  // 2. Malformed Authorization header
  const resMalformed = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Basic dXNlcjpwYXNz',
      },
      body: validPayload,
    },
    resMalformed
  );
  assert.equal(resMalformed.statusCode, 401);

  // 3. Expired or invalid token
  const resInvalid = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer expired_or_forged_jwt_token_value_12345',
      },
      body: validPayload,
    },
    resInvalid
  );
  assert.equal(resInvalid.statusCode, 401);
  assert.equal(resInvalid.jsonBody.error.code, 'UNAUTHORIZED');
});

test('API Security: Enforces email verification before journal mutations (403)', async () => {
  setupTestEnvironment();
  const res = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_unverified_user',
      },
      body: {
        title: 'Test note',
        note: 'Attempt by unverified user.',
        category: 'Nature',
        observedAt: new Date().toISOString(),
      },
    },
    res
  );
  assert.equal(res.statusCode, 403);
  assert.equal(res.jsonBody.error.code, 'EMAIL_NOT_VERIFIED');
});

test('API Security: Rejects wrong Content-Type (415), malformed JSON (400), and oversized payload (413)', async () => {
  setupTestEnvironment();

  // Wrong Content-Type
  const res415 = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: 'plain text',
    },
    res415
  );
  assert.equal(res415.statusCode, 415);

  // Malformed JSON
  const res400 = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: '{bad json',
    },
    res400
  );
  assert.equal(res400.statusCode, 400);

  // Oversized payload (> 16 KB)
  const res413 = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: JSON.stringify({
        title: 'Oversized',
        note: 'X'.repeat(20 * 1024),
        category: 'Light',
        observedAt: new Date().toISOString(),
      }),
    },
    res413
  );
  assert.equal(res413.statusCode, 413);
  assert.equal(res413.jsonBody.error.code, 'PAYLOAD_TOO_LARGE');
});

test('API Security: Rejects client-side ownership spoofing and unknown properties (400)', async () => {
  setupTestEnvironment();
  const res = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        title: 'Valid title',
        note: 'Valid note',
        category: 'Light',
        observedAt: new Date().toISOString(),
        uid: 'uid_bob', // Spoof attempt
      },
    },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.jsonBody.error.code, 'VALIDATION_ERROR');
});

test('API Security: Prevents cross-user document modification and deletion (IDOR protection)', async () => {
  setupTestEnvironment();

  // Alice creates an entry
  const createRes = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        title: 'Alice private observation',
        note: 'Only Alice can read or modify this.',
        category: 'Nature',
        tags: ['Fern'],
        observedAt: new Date().toISOString(),
      },
    },
    createRes
  );
  assert.equal(createRes.statusCode, 201);
  const aliceEntryId = createRes.jsonBody.data.entry.id;

  // Bob attempts to PATCH Alice's entryId
  const bobPatchRes = createMockRes();
  await entryByIdHandler(
    {
      method: 'PATCH',
      query: { entryId: aliceEntryId },
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_bob_verified',
      },
      body: {
        title: 'Hijacked by Bob',
      },
    },
    bobPatchRes
  );
  assert.equal(bobPatchRes.statusCode, 404);
  assert.equal(bobPatchRes.jsonBody.error.code, 'NOT_FOUND');

  // Bob attempts to DELETE Alice's entryId
  const bobDeleteRes = createMockRes();
  await entryByIdHandler(
    {
      method: 'DELETE',
      query: { entryId: aliceEntryId },
      headers: {
        authorization: 'Bearer valid_token_bob_verified',
      },
    },
    bobDeleteRes
  );
  assert.equal(bobDeleteRes.statusCode, 404);

  // Alice can successfully PATCH and DELETE her own entry
  const alicePatchRes = createMockRes();
  await entryByIdHandler(
    {
      method: 'PATCH',
      query: { entryId: aliceEntryId },
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        title: 'Alice updated observation title',
      },
    },
    alicePatchRes
  );
  assert.equal(alicePatchRes.statusCode, 200);
  assert.equal(alicePatchRes.jsonBody.data.entry.title, 'Alice updated observation title');

  const aliceDeleteRes = createMockRes();
  await entryByIdHandler(
    {
      method: 'DELETE',
      query: { entryId: aliceEntryId },
      headers: {
        authorization: 'Bearer valid_token_alice_verified',
      },
    },
    aliceDeleteRes
  );
  assert.equal(aliceDeleteRes.statusCode, 200);
});

test('API Security: Enforces rate limiting (429 with Retry-After) and masks internal DB errors (500)', async () => {
  // 1. Rate-limit exceeded
  setupTestEnvironment({ rateLimitAllowed: false });
  const res429 = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        title: 'Valid title',
        note: 'Valid note',
        category: 'Light',
        observedAt: new Date().toISOString(),
      },
    },
    res429
  );
  assert.equal(res429.statusCode, 429);
  assert.equal(res429.headers['retry-after'], '42');
  assert.equal(res429.jsonBody.error.code, 'RATE_LIMITED');

  // 2. Internal Firestore exception is safely masked (no secret path leaked)
  setupTestEnvironment({ rateLimitAllowed: true, firestoreThrows: true });
  const res500 = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        title: 'Valid title',
        note: 'Valid note',
        category: 'Light',
        observedAt: new Date().toISOString(),
      },
    },
    res500
  );
  assert.equal(res500.statusCode, 500);
  assert.equal(res500.jsonBody.error.code, 'INTERNAL_ERROR');
  assert.equal(
    JSON.stringify(res500.jsonBody).includes('SECRET_PATH'),
    false,
    'Internal exception details must never leak to client responses'
  );
});

test('API Security: Fails closed (503) when production rate-limit infrastructure is missing', async () => {
  setupTestEnvironment();
  // Remove test rate-limit store so handler checks real Upstash Redis env vars
  setRateLimitStoreForTesting(null);
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const res503 = createMockRes();
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        title: 'Valid title',
        note: 'Valid note',
        category: 'Light',
        observedAt: new Date().toISOString(),
      },
    },
    res503
  );
  assert.equal(res503.statusCode, 503);
  assert.equal(res503.jsonBody.error.code, 'SERVICE_UNAVAILABLE');
});

test('API Security: Account deletion endpoint requires confirmation phrase and deletes only caller data', async () => {
  const { dbStore } = setupTestEnvironment();

  // Seed entries for Alice and Bob
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        title: 'Alice note',
        note: 'Note 1',
        category: 'Light',
        observedAt: new Date().toISOString(),
      },
    },
    createMockRes()
  );
  await entriesHandler(
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_bob_verified',
      },
      body: {
        title: 'Bob note',
        note: 'Note 2',
        category: 'Sound',
        observedAt: new Date().toISOString(),
      },
    },
    createMockRes()
  );

  // Alice deletes her account
  const delRes = createMockRes();
  await accountHandler(
    {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer valid_token_alice_verified',
      },
      body: {
        confirmationText: 'DELETE MY JOURNAL',
      },
    },
    delRes
  );
  assert.equal(delRes.statusCode, 200);
  assert.equal(delRes.jsonBody.data.deletedAccount, true);
  assert.equal(delRes.jsonBody.data.deletedEntriesCount, 1);
  assert.equal(dbStore.has('uid_alice'), false);
  assert.equal(dbStore.has('uid_bob'), true, 'Bob entries must remain untouched');
});
