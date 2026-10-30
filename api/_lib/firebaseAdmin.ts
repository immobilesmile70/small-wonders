import crypto from 'node:crypto';
import type { JournalEntry } from '../../src/types/journal';

export interface DecodedAuthToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    sign_in_provider?: string;
  };
}

export interface AdminEntryDoc {
  title: string;
  note: string;
  category: JournalEntry['category'];
  tags: string[];
  observedAt: string;
  placeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface AdminBackendAdapter {
  verifyIdToken: (idToken: string, checkRevoked?: boolean) => Promise<DecodedAuthToken>;
  verifyAppCheckToken: (appCheckToken: string) => Promise<{ appId: string }>;
  createEntry: (uid: string, entryId: string, data: AdminEntryDoc) => Promise<JournalEntry>;
  updateEntry: (
    uid: string,
    entryId: string,
    updates: Partial<Omit<AdminEntryDoc, 'createdAt' | 'schemaVersion'>>
  ) => Promise<JournalEntry | null>;
  deleteEntry: (uid: string, entryId: string) => Promise<boolean>;
  deleteUserAccountAndData: (uid: string) => Promise<{ deletedEntriesCount: number }>;
}

let injectedAdapter: AdminBackendAdapter | null = null;
let cachedProductionAdapter: AdminBackendAdapter | null = null;

/**
 * Allows unit and integration tests to inject an isolated emulator/test adapter
 * without mutating production configuration.
 */
export function setAdminBackendAdapterForTesting(adapter: AdminBackendAdapter | null): void {
  injectedAdapter = adapter;
}

/**
 * Generates a cryptographically random, URL-safe entry ID on the server.
 * Matches `entryIdSchema` (`/^[a-zA-Z0-9_-]{10,48}$/`).
 */
export function generateServerEntryId(): string {
  const bytes = crypto.randomBytes(16);
  return `sw_${bytes.toString('base64url')}`;
}

function getServiceAccountFromEnv(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  const rawJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim().length > 0) {
    const parsed = JSON.parse(rawJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      };
    }
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey && !privateKey.includes('REPLACE_WITH_PRIVATE_KEY')) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

export async function getAdminBackend(): Promise<AdminBackendAdapter> {
  if (injectedAdapter) {
    return injectedAdapter;
  }
  if (cachedProductionAdapter) {
    return cachedProductionAdapter;
  }

  const creds = getServiceAccountFromEnv();
  const isEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );

  if (!creds && !isEmulator) {
    const err = new Error('Server Firebase Admin credentials are not configured.');
    err.name = 'ConfigurationError';
    throw err;
  }

  // Dynamic import of firebase-admin so module stays clean and lazy-loaded on cold start
  const adminAppModule = await import('firebase-admin/app');
  const adminAuthModule = await import('firebase-admin/auth');
  const adminFirestoreModule = await import('firebase-admin/firestore');
  const adminAppCheckModule = await import('firebase-admin/app-check');

  if (adminAppModule.getApps().length === 0) {
    if (creds) {
      adminAppModule.initializeApp({
        credential: adminAppModule.cert({
          projectId: creds.projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.privateKey,
        }),
        projectId: creds.projectId,
      });
    } else {
      adminAppModule.initializeApp({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'small-wonders-emulator',
      });
    }
  }

  const auth = adminAuthModule.getAuth();
  const db = adminFirestoreModule.getFirestore();
  const appCheck = adminAppCheckModule.getAppCheck();

  cachedProductionAdapter = {
    async verifyIdToken(idToken: string, checkRevoked = true): Promise<DecodedAuthToken> {
      const decoded = await auth.verifyIdToken(idToken, checkRevoked);
      return {
        uid: decoded.uid,
        email: decoded.email,
        email_verified: decoded.email_verified,
        firebase: decoded.firebase,
      };
    },

    async verifyAppCheckToken(appCheckToken: string): Promise<{ appId: string }> {
      const verified = await appCheck.verifyToken(appCheckToken);
      return { appId: verified.appId };
    },

    async createEntry(uid: string, entryId: string, data: AdminEntryDoc): Promise<JournalEntry> {
      const docRef = db.collection('users').doc(uid).collection('entries').doc(entryId);
      const observedTimestamp = adminFirestoreModule.Timestamp.fromDate(new Date(data.observedAt));
      const nowTimestamp = adminFirestoreModule.Timestamp.fromDate(new Date(data.createdAt));

      await docRef.create({
        title: data.title,
        note: data.note,
        category: data.category,
        tags: data.tags,
        observedAt: observedTimestamp,
        placeLabel: data.placeLabel,
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
        schemaVersion: data.schemaVersion,
      });

      return {
        id: entryId,
        ...data,
      };
    },

    async updateEntry(uid, entryId, updates): Promise<JournalEntry | null> {
      const docRef = db.collection('users').doc(uid).collection('entries').doc(entryId);

      return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) {
          return null;
        }
        const existing = snap.data() as Record<string, any>;
        const nowIso = new Date().toISOString();
        const firestoreUpdates: Record<string, any> = {
          updatedAt: adminFirestoreModule.Timestamp.fromDate(new Date(nowIso)),
        };

        if (updates.title !== undefined) firestoreUpdates.title = updates.title;
        if (updates.note !== undefined) firestoreUpdates.note = updates.note;
        if (updates.category !== undefined) firestoreUpdates.category = updates.category;
        if (updates.tags !== undefined) firestoreUpdates.tags = updates.tags;
        if (updates.placeLabel !== undefined) firestoreUpdates.placeLabel = updates.placeLabel;
        if (updates.observedAt !== undefined) {
          firestoreUpdates.observedAt = adminFirestoreModule.Timestamp.fromDate(
            new Date(updates.observedAt)
          );
        }

        tx.update(docRef, firestoreUpdates);

        const observedAtIso =
          updates.observedAt ??
          (existing.observedAt?.toDate
            ? existing.observedAt.toDate().toISOString()
            : String(existing.observedAt));

        const createdAtIso = existing.createdAt?.toDate
          ? existing.createdAt.toDate().toISOString()
          : String(existing.createdAt);

        return {
          id: entryId,
          title: updates.title ?? existing.title,
          note: updates.note ?? existing.note,
          category: updates.category ?? existing.category,
          tags: updates.tags ?? existing.tags ?? [],
          observedAt: observedAtIso,
          placeLabel:
            updates.placeLabel !== undefined ? updates.placeLabel : (existing.placeLabel ?? null),
          createdAt: createdAtIso,
          updatedAt: nowIso,
          schemaVersion: existing.schemaVersion ?? 1,
        };
      });
    },

    async deleteEntry(uid: string, entryId: string): Promise<boolean> {
      const docRef = db.collection('users').doc(uid).collection('entries').doc(entryId);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) {
          return false;
        }
        tx.delete(docRef);
        return true;
      });
    },

    async deleteUserAccountAndData(uid: string): Promise<{ deletedEntriesCount: number }> {
      const entriesCollection = db.collection('users').doc(uid).collection('entries');
      let deletedEntriesCount = 0;
      const BATCH_LIMIT = 100;
      const MAX_ITERATIONS = 50; // Caps single request work at 5,000 entries to prevent unbounded loops

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const snapshot = await entriesCollection.limit(BATCH_LIMIT).get();
        if (snapshot.empty) {
          break;
        }
        const batch = db.batch();
        for (const doc of snapshot.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
        deletedEntriesCount += snapshot.size;
        if (snapshot.size < BATCH_LIMIT) {
          break;
        }
      }

      // Delete root user metadata document if present
      const userDocRef = db.collection('users').doc(uid);
      await userDocRef.delete();

      // Finally remove the Firebase Authentication user record
      await auth.deleteUser(uid);

      return { deletedEntriesCount };
    },
  };

  return cachedProductionAdapter;
}
