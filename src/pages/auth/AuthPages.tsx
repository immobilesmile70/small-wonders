import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, InputField, useToast } from '../../components/ui/Primitives';
import { useAuth } from '../../features/auth/AuthContext';

function getSafeReturnPath(search: string): string {
  const params = new URLSearchParams(search);
  const next = params.get('returnTo');
  if (next && next.startsWith('/app') && !next.startsWith('//')) {
    return next;
  }
  return '/app';
}

export const SignInPage: React.FC = () => {
  const { status, signInWithEmail, signInWithGoogle, errorMessage, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnTo = getSafeReturnPath(location.search);

  if (status === 'authenticated') {
    return <Navigate to={returnTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
      showToast('Welcome back to your field journal.', 'success');
      navigate(returnTo, { replace: true });
    } catch {
      // Error state is managed by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    clearError();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      showToast('Signed in with Google.', 'success');
      navigate(returnTo, { replace: true });
    } catch {
      // Error state is managed by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="premium-container section-band"
      style={{ maxWidth: '480px' }}
    >
      <div className="glass edge" style={{ padding: 'var(--space-4)' }}>
        <h1 className="heading-card" style={{ fontSize: 'var(--step-3)', marginBottom: 'var(--space-1)' }}>
          Return to your journal
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', marginBottom: 'var(--space-3)' }}>
          Sign in to read or record your private observations.
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
              backgroundColor: 'var(--danger-surface)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--step--1)',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <InputField
            label="Email address"
            type="email"
            autoComplete="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <InputField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              to="/forgot-password"
              style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}
            >
              Forgot your password?
            </Link>
          </div>

          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <div style={{ borderTop: '1px solid var(--line)', margin: 'var(--space-3) 0' }} />

        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => void handleGoogle()}
          style={{ width: '100%' }}
        >
          Continue with Google
        </Button>

        <p
          style={{
            marginTop: 'var(--space-3)',
            marginBottom: 0,
            fontSize: 'var(--step--1)',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          New to Small Wonders?{' '}
          <Link to="/sign-up" style={{ color: 'var(--accent-b)', fontWeight: 600 }}>
            Start your journal
          </Link>
        </p>
      </div>
    </div>
  );
};

export const SignUpPage: React.FC = () => {
  const { status, signUpWithEmail, signInWithGoogle, errorMessage, clearError } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName);
      showToast('Your private field journal is ready.', 'success');
      navigate('/app', { replace: true });
    } catch {
      // Handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    clearError();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      showToast('Your private field journal is ready.', 'success');
      navigate('/app', { replace: true });
    } catch {
      // Handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="premium-container section-band"
      style={{ maxWidth: '480px' }}
    >
      <div className="glass edge" style={{ padding: 'var(--space-4)' }}>
        <h1 className="heading-card" style={{ fontSize: 'var(--step-3)', marginBottom: 'var(--space-1)' }}>
          Begin your field journal
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', marginBottom: 'var(--space-3)' }}>
          A private space for the small observations you want to keep.
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
              backgroundColor: 'var(--danger-surface)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--step--1)',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <InputField
            label="First name or pen name (optional)"
            type="text"
            autoComplete="name"
            maxLength={60}
            placeholder="Your Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <InputField
            label="Email address"
            type="email"
            autoComplete="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <InputField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 8 characters"
            helperText="Minimum 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Start your journal
          </Button>
        </form>

        <div style={{ borderTop: '1px solid var(--line)', margin: 'var(--space-3) 0' }} />

        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => void handleGoogle()}
          style={{ width: '100%' }}
        >
          Continue with Google
        </Button>

        <p
          style={{
            marginTop: 'var(--space-3)',
            marginBottom: 0,
            fontSize: 'var(--step--1)',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Already have a journal?{' '}
          <Link to="/sign-in" style={{ color: 'var(--accent-b)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const { sendPasswordReset, errorMessage, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch {
      // Handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="premium-container section-band"
      style={{ maxWidth: '480px' }}
    >
      <div className="glass edge" style={{ padding: 'var(--space-4)' }}>
        <h1 className="heading-card" style={{ fontSize: 'var(--step-3)', marginBottom: 'var(--space-1)' }}>
          Reset your password
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', marginBottom: 'var(--space-3)' }}>
          Enter the email address linked to your journal and we will send password reset instructions.
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-2)',
              marginBottom: 'var(--space-2)',
              backgroundColor: 'var(--danger-surface)',
              color: 'var(--danger)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--step--1)',
            }}
          >
            {errorMessage}
          </div>
        )}

        {sent ? (
          <div
            role="status"
            className="surface-elevated"
            style={{ marginBottom: 'var(--space-2)' }}
          >
            If an account exists for <strong>{email}</strong>, a password reset link has been dispatched.
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
          >
            <InputField
              label="Email address"
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Send reset instructions
            </Button>
          </form>
        )}

        <div style={{ marginTop: 'var(--space-3)', textAlign: 'center' }}>
          <Link to="/sign-in" style={{ fontSize: 'var(--step--1)', color: 'var(--accent-b)' }}>
            Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export const VerifyEmailPage: React.FC = () => {
  const { user, isFirebaseConfigured, sendVerificationEmail, markEmailVerifiedInSandbox } =
    useAuth();
  const { showToast } = useToast();

  if (user?.emailVerified) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div
      className="premium-container section-band"
      style={{ maxWidth: '480px' }}
    >
      <div className="glass edge" style={{ padding: 'var(--space-4)' }}>
        <h1 className="heading-card" style={{ fontSize: 'var(--step-3)', marginBottom: 'var(--space-1)' }}>
          Verify your email address
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', marginBottom: 'var(--space-3)' }}>
          To protect your private field journal, Small Wonders verifies email ownership before accepting new or updated observations.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => {
              void sendVerificationEmail();
              showToast('Verification email sent.', 'info');
            }}
          >
            Resend verification email
          </Button>
          {!isFirebaseConfigured && (
            <Button
              variant="secondary"
              onClick={() => {
                void markEmailVerifiedInSandbox();
                showToast('Email verified in local sandbox mode.', 'success');
              }}
            >
              Simulate verification (Sandbox)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
