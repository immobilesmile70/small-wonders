import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseClientServices, getFirebaseConfigStatus } from '../../services/firebase/client';

export type AuthStatus =
  | 'initializing'
  | 'signed_out'
  | 'verification_required'
  | 'authenticated';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  providerId: 'password' | 'google.com';
  createdAtIso: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  isFirebaseConfigured: boolean;
  usingEmulators: boolean;
  errorMessage: string | null;
  clearError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  markEmailVerifiedInSandbox: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const SANDBOX_SESSION_KEY = 'sw_local_sandbox_auth_user_v1';
const SANDBOX_ACCOUNTS_KEY = 'sw_local_sandbox_accounts_v1';

interface SandboxAccountRecord {
  uid: string;
  email: string;
  displayName: string | null;
  passwordHashSim: string;
  emailVerified: boolean;
  providerId: 'password' | 'google.com';
  createdAtIso: string;
}

export function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support if you believe this is an error.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'No account matched that email and password combination.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Please choose a stronger password of at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful sign-in attempts. Please wait a few minutes before trying again.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before completing authentication.';
    case 'auth/network-request-failed':
      return 'Network error while reaching the authentication service. Please check your connection.';
    case 'auth/requires-recent-login':
      return 'For your security, please sign out and sign back in before performing this sensitive action.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Authentication could not be completed. Please try again.';
  }
}

function mapFirebaseUserToAppUser(fbUser: FirebaseUser): AppUser {
  const primaryProvider = fbUser.providerData[0]?.providerId;
  const providerId: 'password' | 'google.com' =
    primaryProvider === 'google.com' ? 'google.com' : 'password';

  return {
    uid: fbUser.uid,
    email: fbUser.email || 'observer@smallwonders.local',
    displayName: fbUser.displayName || null,
    emailVerified: fbUser.emailVerified || providerId === 'google.com',
    providerId,
    createdAtIso: fbUser.metadata.creationTime
      ? new Date(fbUser.metadata.creationTime).toISOString()
      : new Date().toISOString(),
  };
}

function readSandboxAccounts(): SandboxAccountRecord[] {
  try {
    const raw = window.localStorage.getItem(SANDBOX_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSandboxAccounts(accounts: SandboxAccountRecord[]): void {
  try {
    window.localStorage.setItem(SANDBOX_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota errors in constrained iframes
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const configStatus = useMemo(() => getFirebaseConfigStatus(), []);
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = useCallback(() => setErrorMessage(null), []);

  useEffect(() => {
    if (configStatus.isConfigured) {
      try {
        const { auth } = getFirebaseClientServices();
        const unsubscribe = onAuthStateChanged(
          auth,
          (fbUser) => {
            setFirebaseUser(fbUser);
            if (!fbUser) {
              setUser(null);
              setStatus('signed_out');
              return;
            }
            const mapped = mapFirebaseUserToAppUser(fbUser);
            setUser(mapped);
            setStatus(mapped.emailVerified ? 'authenticated' : 'verification_required');
          },
          () => {
            setUser(null);
            setStatus('signed_out');
          }
        );
        return () => unsubscribe();
      } catch {
        setStatus('signed_out');
      }
      return;
    }

    // Local development / sandbox session restoration when Firebase env vars are placeholders
    try {
      const savedRaw = window.localStorage.getItem(SANDBOX_SESSION_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as AppUser;
        if (parsed && typeof parsed.uid === 'string' && typeof parsed.email === 'string') {
          setUser(parsed);
          setStatus(parsed.emailVerified ? 'authenticated' : 'verification_required');
          return;
        }
      }
    } catch {
      // Fall through to signed_out
    }
    setStatus('signed_out');
  }, [configStatus.isConfigured]);

  const persistSandboxSession = useCallback((nextUser: AppUser | null) => {
    try {
      if (nextUser) {
        window.localStorage.setItem(SANDBOX_SESSION_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(SANDBOX_SESSION_KEY);
      }
    } catch {
      // Safe fallback
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setErrorMessage(null);
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || ! cleanEmail.includes('@')) {
        const msg = 'Please enter a valid email address.';
        setErrorMessage(msg);
        throw new Error(msg);
      }
      if (!password || password.length < 8) {
        const msg = 'Password must be at least 8 characters.';
        setErrorMessage(msg);
        throw new Error(msg);
      }

      if (configStatus.isConfigured) {
        try {
          const { auth } = getFirebaseClientServices();
          await signInWithEmailAndPassword(auth, cleanEmail, password);
          return;
        } catch (err) {
          const friendly = mapFirebaseAuthError(err);
          setErrorMessage(friendly);
          throw new Error(friendly);
        }
      }

      const accounts = readSandboxAccounts();
      const match = accounts.find(
        (acc) => acc.email === cleanEmail && acc.passwordHashSim === `sim:${password}`
      );
      if (!match) {
        const friendly = mapFirebaseAuthError({ code: 'auth/invalid-credential' });
        setErrorMessage(friendly);
        throw new Error(friendly);
      }
      const appUser: AppUser = {
        uid: match.uid,
        email: match.email,
        displayName: match.displayName,
        emailVerified: match.emailVerified,
        providerId: match.providerId,
        createdAtIso: match.createdAtIso,
      };
      setUser(appUser);
      persistSandboxSession(appUser);
      setStatus(appUser.emailVerified ? 'authenticated' : 'verification_required');
    },
    [configStatus.isConfigured, persistSandboxSession]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setErrorMessage(null);
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = displayName?.trim() ? displayName.trim().slice(0, 60) : null;

      if (!cleanEmail || !cleanEmail.includes('@')) {
        const msg = 'Please enter a valid email address.';
        setErrorMessage(msg);
        throw new Error(msg);
      }
      if (!password || password.length < 8) {
        const msg = mapFirebaseAuthError({ code: 'auth/weak-password' });
        setErrorMessage(msg);
        throw new Error(msg);
      }

      if (configStatus.isConfigured) {
        try {
          const { auth } = getFirebaseClientServices();
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          if (cleanName) {
            await updateProfile(cred.user, { displayName: cleanName });
          }
          await sendEmailVerification(cred.user);
          return;
        } catch (err) {
          const friendly = mapFirebaseAuthError(err);
          setErrorMessage(friendly);
          throw new Error(friendly);
        }
      }

      const accounts = readSandboxAccounts();
      if (accounts.some((acc) => acc.email === cleanEmail)) {
        const friendly = mapFirebaseAuthError({ code: 'auth/email-already-in-use' });
        setErrorMessage(friendly);
        throw new Error(friendly);
      }

      const uid = `usr_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
      const createdAtIso = new Date().toISOString();
      const newRecord: SandboxAccountRecord = {
        uid,
        email: cleanEmail,
        displayName: cleanName,
        passwordHashSim: `sim:${password}`,
        emailVerified: true,
        providerId: 'password',
        createdAtIso,
      };
      writeSandboxAccounts([...accounts, newRecord]);

      const appUser: AppUser = {
        uid,
        email: cleanEmail,
        displayName: cleanName,
        emailVerified: true,
        providerId: 'password',
        createdAtIso,
      };
      setUser(appUser);
      persistSandboxSession(appUser);
      setStatus('authenticated');
    },
    [configStatus.isConfigured, persistSandboxSession]
  );

  const signInWithGoogle = useCallback(async () => {
    setErrorMessage(null);
    if (configStatus.isConfigured) {
      try {
        const { auth } = getFirebaseClientServices();
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
        return;
      } catch (err) {
        const friendly = mapFirebaseAuthError(err);
        setErrorMessage(friendly);
        throw new Error(friendly);
      }
    }

    const accounts = readSandboxAccounts();
    const googleEmail = 'claire.valen@example.com';
    let record = accounts.find((a) => a.email === googleEmail);
    if (!record) {
      record = {
        uid: 'usr_google_claire_valen',
        email: googleEmail,
        displayName: 'Claire Valen',
        passwordHashSim: 'google-oauth',
        emailVerified: true,
        providerId: 'google.com',
        createdAtIso: new Date().toISOString(),
      };
      writeSandboxAccounts([...accounts, record]);
    }
    const appUser: AppUser = {
      uid: record.uid,
      email: record.email,
      displayName: record.displayName,
      emailVerified: true,
      providerId: 'google.com',
      createdAtIso: record.createdAtIso,
    };
    setUser(appUser);
    persistSandboxSession(appUser);
    setStatus('authenticated');
  }, [configStatus.isConfigured, persistSandboxSession]);

  const sendVerificationEmail = useCallback(async () => {
    setErrorMessage(null);
    if (configStatus.isConfigured && firebaseUser) {
      try {
        await sendEmailVerification(firebaseUser);
      } catch (err) {
        const friendly = mapFirebaseAuthError(err);
        setErrorMessage(friendly);
        throw new Error(friendly);
      }
    }
  }, [configStatus.isConfigured, firebaseUser]);

  const markEmailVerifiedInSandbox = useCallback(async () => {
    if (!user) return;
    const updatedUser: AppUser = { ...user, emailVerified: true };
    const accounts = readSandboxAccounts().map((a) =>
      a.uid === user.uid ? { ...a, emailVerified: true } : a
    );
    writeSandboxAccounts(accounts);
    setUser(updatedUser);
    persistSandboxSession(updatedUser);
    setStatus('authenticated');
  }, [user, persistSandboxSession]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      setErrorMessage(null);
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        const msg = 'Please enter the email address associated with your journal.';
        setErrorMessage(msg);
        throw new Error(msg);
      }
      if (configStatus.isConfigured) {
        try {
          const { auth } = getFirebaseClientServices();
          await sendPasswordResetEmail(auth, cleanEmail);
        } catch (err) {
          const friendly = mapFirebaseAuthError(err);
          setErrorMessage(friendly);
          throw new Error(friendly);
        }
      }
    },
    [configStatus.isConfigured]
  );

  const signOut = useCallback(async () => {
    setErrorMessage(null);
    if (configStatus.isConfigured) {
      const { auth } = getFirebaseClientServices();
      await firebaseSignOut(auth);
    }
    persistSandboxSession(null);
    setUser(null);
    setStatus('signed_out');
  }, [configStatus.isConfigured, persistSandboxSession]);

  const getIdToken = useCallback(async (): Promise<string> => {
    if (configStatus.isConfigured && firebaseUser) {
      return firebaseUser.getIdToken();
    }
    if (user) {
      return `sandbox_token_${user.uid}`;
    }
    throw new Error('Not authenticated.');
  }, [configStatus.isConfigured, firebaseUser, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isFirebaseConfigured: configStatus.isConfigured,
      usingEmulators: configStatus.usingEmulators,
      errorMessage,
      clearError,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendVerificationEmail,
      markEmailVerifiedInSandbox,
      sendPasswordReset,
      signOut,
      getIdToken,
    }),
    [
      status,
      user,
      configStatus.isConfigured,
      configStatus.usingEmulators,
      errorMessage,
      clearError,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendVerificationEmail,
      markEmailVerifiedInSandbox,
      sendPasswordReset,
      signOut,
      getIdToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return ctx;
}
