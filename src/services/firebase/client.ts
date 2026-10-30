import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken,
  type AppCheck,
} from 'firebase/app-check';

export interface FirebaseClientConfigStatus {
  isConfigured: boolean;
  usingEmulators: boolean;
  appCheckEnabled: boolean;
  projectId: string;
}

function getEnvVar(key: string, fallback = ''): string {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (metaEnv && typeof metaEnv[key] === 'string') {
      return metaEnv[key] || fallback;
    }
  } catch {
    // Fallback for Node test environments
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    return process.env[key] || fallback;
  }
  return fallback;
}

const apiKey = getEnvVar('VITE_FIREBASE_API_KEY', '');
const authDomain = getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', '');
const projectId = getEnvVar('VITE_FIREBASE_PROJECT_ID', '');
const storageBucket = getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', '');
const messagingSenderId = getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', '');
const appId = getEnvVar('VITE_FIREBASE_APP_ID', '');
const useEmulators = getEnvVar('VITE_USE_FIREBASE_EMULATORS', 'false') === 'true';
const enableAppCheck = getEnvVar('VITE_ENABLE_APP_CHECK', 'false') === 'true';
const appCheckSiteKey = getEnvVar('VITE_FIREBASE_APPCHECK_SITE_KEY', '');

export function getFirebaseConfigStatus(): FirebaseClientConfigStatus {
  const hasRealConfig =
    Boolean(apiKey) &&
    !apiKey.includes('PLACEHOLDER') &&
    Boolean(projectId) &&
    projectId !== 'your-project-id';

  return {
    isConfigured: hasRealConfig || useEmulators,
    usingEmulators: useEmulators,
    appCheckEnabled: enableAppCheck && Boolean(appCheckSiteKey) && !appCheckSiteKey.includes('PLACEHOLDER'),
    projectId: projectId || (useEmulators ? 'small-wonders-emulator' : 'unconfigured'),
  };
}

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseAuthInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let appCheckInstance: AppCheck | null = null;
let emulatorsConnected = false;

export function getFirebaseClientServices(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  appCheck: AppCheck | null;
} {
  const status = getFirebaseConfigStatus();
  if (!status.isConfigured) {
    throw new Error(
      'Firebase client environment variables are not configured. Copy .env.example to .env.local and provide your Firebase project configuration or enable local emulators.'
    );
  }

  if (!firebaseAppInstance) {
    const existingApps = getApps();
    firebaseAppInstance =
      existingApps.length > 0
        ? existingApps[0]
        : initializeApp({
            apiKey: apiKey || 'demo-emulator-api-key',
            authDomain: authDomain || 'localhost',
            projectId: status.projectId,
            storageBucket: storageBucket || `${status.projectId}.appspot.com`,
            messagingSenderId: messagingSenderId || '000000000000',
            appId: appId || '1:000000000000:web:emulator',
          });
  }

  if (!firebaseAuthInstance) {
    firebaseAuthInstance = getAuth(firebaseAppInstance);
  }

  if (!firestoreInstance) {
    firestoreInstance = getFirestore(firebaseAppInstance);
  }

  if (status.usingEmulators && !emulatorsConnected) {
    const authHost = getEnvVar('VITE_FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    const firestoreHost = getEnvVar('VITE_FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
    const [fsHost, fsPortStr] = firestoreHost.split(':');
    connectAuthEmulator(firebaseAuthInstance, `http://${authHost}`, { disableWarnings: true });
    connectFirestoreEmulator(firestoreInstance, fsHost || '127.0.0.1', Number(fsPortStr || 8080));
    emulatorsConnected = true;
  }

  if (status.appCheckEnabled && !appCheckInstance && typeof window !== 'undefined') {
    appCheckInstance = initializeAppCheck(firebaseAppInstance, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  return {
    app: firebaseAppInstance,
    auth: firebaseAuthInstance,
    db: firestoreInstance,
    appCheck: appCheckInstance,
  };
}

export async function getOptionalAppCheckHeaderToken(): Promise<string | null> {
  try {
    const status = getFirebaseConfigStatus();
    if (!status.appCheckEnabled || !appCheckInstance) {
      return null;
    }
    const result = await getAppCheckToken(appCheckInstance, false);
    return result.token || null;
  } catch {
    return null;
  }
}
