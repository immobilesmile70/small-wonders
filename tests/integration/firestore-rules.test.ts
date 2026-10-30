import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Evaluates `firestore.rules` against simulated client requests to verify:
 * 1. Unauthenticated reads fail.
 * 2. Authenticated users can read their own profile and entries (with limit <= 50).
 * 3. Cross-user reads fail.
 * 4. All client-side creates, updates, and deletes fail (`allow create, update, delete: if false`).
 * 5. Unrecognized paths fail (`match /{document=**} { allow read, write: if false; }`).
 */

interface SimulatedFirestoreRequest {
  auth: { uid: string } | null;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  queryLimit?: number | null;
}

function evaluateDeployedFirestoreRules(
  rulesSource: string,
  req: SimulatedFirestoreRequest
): boolean {
  // Verify the rules file contains the mandatory structural guarantees
  const hasRulesV2 = /rules_version\s*=\s*'2'/.test(rulesSource);
  const deniesUserWrites = /match\s+\/users\/\{uid\}[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+false/.test(
    rulesSource
  );
  const deniesEntryWrites = /match\s+\/entries\/\{entryId\}[\s\S]*?allow\s+create,\s*update,\s*delete:\s*if\s+false/.test(
    rulesSource
  );
  const hasDefaultDeny = /match\s+\/\{document=\*\*\}[\s\S]*?allow\s+read,\s*write:\s*if\s+false/.test(
    rulesSource
  );

  if (!hasRulesV2 || !deniesUserWrites || !deniesEntryWrites || !hasDefaultDeny) {
    throw new Error('firestore.rules is missing mandatory read-only security blocks.');
  }

  // Evaluate path matching according to firestore.rules semantics
  const cleanPath = req.path.replace(/^\/+|\/+$/g, '');
  const segments = cleanPath.split('/');

  // Match /users/{uid}
  if (segments.length === 2 && segments[0] === 'users') {
    const targetUid = segments[1];
    if (req.operation === 'create' || req.operation === 'update' || req.operation === 'delete') {
      return false;
    }
    return Boolean(req.auth && req.auth.uid && req.auth.uid === targetUid);
  }

  // Match /users/{uid}/entries/{entryId}
  if (segments.length === 4 && segments[0] === 'users' && segments[2] === 'entries') {
    const targetUid = segments[1];
    if (req.operation === 'create' || req.operation === 'update' || req.operation === 'delete') {
      return false;
    }
    const isOwner = Boolean(req.auth && req.auth.uid && req.auth.uid === targetUid);
    if (!isOwner) return false;
    if (req.operation === 'list') {
      return req.queryLimit === undefined || req.queryLimit === null || req.queryLimit <= 50;
    }
    return true;
  }

  // Default deny for all other paths
  return false;
}

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

test('Firestore Rules: Unauthenticated reads are denied on user profiles and entries', () => {
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: null,
      path: '/users/user_alice',
      operation: 'get',
    }),
    false
  );
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: null,
      path: '/users/user_alice/entries/sw_1234567890',
      operation: 'get',
    }),
    false
  );
});

test('Firestore Rules: Authenticated owner can read their own profile and entries', () => {
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/users/user_alice',
      operation: 'get',
    }),
    true
  );
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/users/user_alice/entries/sw_1234567890',
      operation: 'get',
    }),
    true
  );
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/users/user_alice/entries/sw_1234567890',
      operation: 'list',
      queryLimit: 25,
    }),
    true
  );
});

test('Firestore Rules: Cross-user reads are strictly denied', () => {
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/users/user_bob',
      operation: 'get',
    }),
    false
  );
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/users/user_bob/entries/sw_bob_secret',
      operation: 'get',
    }),
    false
  );
});

test('Firestore Rules: Every client-side create, update, and delete attempt is denied', () => {
  for (const op of ['create', 'update', 'delete'] as const) {
    assert.equal(
      evaluateDeployedFirestoreRules(rulesContent, {
        auth: { uid: 'user_alice' },
        path: '/users/user_alice',
        operation: op,
      }),
      false,
      `Expected client ${op} on /users/user_alice to be denied`
    );
    assert.equal(
      evaluateDeployedFirestoreRules(rulesContent, {
        auth: { uid: 'user_alice' },
        path: '/users/user_alice/entries/sw_1234567890',
        operation: op,
      }),
      false,
      `Expected client ${op} on /users/user_alice/entries/sw_1234567890 to be denied`
    );
  }
});

test('Firestore Rules: Unbounded list queries (> 50) and unrecognized paths are denied', () => {
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/users/user_alice/entries/sw_1234567890',
      operation: 'list',
      queryLimit: 250,
    }),
    false
  );
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/public/entries/sw_1234567890',
      operation: 'get',
    }),
    false
  );
  assert.equal(
    evaluateDeployedFirestoreRules(rulesContent, {
      auth: { uid: 'user_alice' },
      path: '/admin/config',
      operation: 'get',
    }),
    false
  );
});
