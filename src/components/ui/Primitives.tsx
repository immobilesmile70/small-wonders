import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { EntryCategory } from '../../types/journal';

/**
 * Shared token-driven UI component library (Section 7.5 of `premium-design`).
 * Consumes CSS custom properties from `src/styles/theme.css` without hard-coded hex values.
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...rest
}) => {
  const sizeClass =
    size === 'sm' ? 'btn-pill-sm' : size === 'lg' ? 'btn-pill-lg' : '';
  const variantClass = `btn-${variant}`;

  return (
    <button
      disabled={disabled || isLoading}
      className={`btn-pill ${variantClass} ${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {isLoading ? 'Saving...' : children}
    </button>
  );
};

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section';
  featuredEdge?: boolean;
  glass?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  as: Tag = 'div',
  featuredEdge = false,
  glass = false,
  children,
  className = '',
  onMouseMove,
  ...rest
}) => {
  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = `${e.clientX - rect.left}px`;
    const y = `${e.clientY - rect.top}px`;
    e.currentTarget.style.setProperty('--mx', x);
    e.currentTarget.style.setProperty('--my', y);
    onMouseMove?.(e);
  };

  const surfaceClass = glass ? 'glass' : 'spot';
  const edgeClass = featuredEdge ? 'edge' : '';

  return (
    <Tag
      onMouseMove={handlePointerMove}
      className={`${surfaceClass} ${edgeClass} ${className}`.trim()}
      style={{ padding: 'var(--space-3)' }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  errorText?: string;
  rightMeta?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  helperText,
  errorText,
  rightMeta,
  id,
  ...rest
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label
          htmlFor={inputId}
          style={{
            fontSize: 'var(--step--1)',
            fontWeight: 500,
            color: 'var(--text)',
          }}
        >
          {label}
        </label>
        {rightMeta && (
          <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
            {rightMeta}
          </span>
        )}
      </div>
      <input
        id={inputId}
        className="input-control"
        aria-invalid={Boolean(errorText)}
        aria-describedby={
          [helperText ? helperId : '', errorText ? errorId : ''].filter(Boolean).join(' ') ||
          undefined
        }
        {...rest}
      />
      {helperText && !errorText && (
        <span id={helperId} style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
          {helperText}
        </span>
      )}
      {errorText && (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: 'var(--step--1)', color: 'var(--danger)', fontWeight: 500 }}
        >
          {errorText}
        </span>
      )}
    </div>
  );
};

export interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  errorText?: string;
  rightMeta?: string;
}

export const TextareaField: React.FC<TextareaFieldProps> = ({
  label,
  helperText,
  errorText,
  rightMeta,
  id,
  ...rest
}) => {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const helperId = `${textareaId}-helper`;
  const errorId = `${textareaId}-error`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label
          htmlFor={textareaId}
          style={{
            fontSize: 'var(--step--1)',
            fontWeight: 500,
            color: 'var(--text)',
          }}
        >
          {label}
        </label>
        {rightMeta && (
          <span className="font-mono-meta" style={{ color: 'var(--text-muted)' }}>
            {rightMeta}
          </span>
        )}
      </div>
      <textarea
        id={textareaId}
        className="textarea-control"
        aria-invalid={Boolean(errorText)}
        aria-describedby={
          [helperText ? helperId : '', errorText ? errorId : ''].filter(Boolean).join(' ') ||
          undefined
        }
        {...rest}
      />
      {helperText && !errorText && (
        <span id={helperId} style={{ fontSize: 'var(--step--1)', color: 'var(--text-muted)' }}>
          {helperText}
        </span>
      )}
      {errorText && (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: 'var(--step--1)', color: 'var(--danger)', fontWeight: 500 }}
        >
          {errorText}
        </span>
      )}
    </div>
  );
};

export const CategoryLabel: React.FC<{ category: EntryCategory }> = ({ category }) => {
  return <span className="badge-pill">{category}</span>;
};

export interface ModalDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  title,
  description,
  onClose,
  children,
}) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'color-mix(in oklab, var(--canvas) 76%, transparent)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-2)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="glass edge"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: 'var(--space-4)',
        }}
      >
        <h2 id={titleId} className="heading-card" style={{ marginBottom: 'var(--space-1)' }}>
          {title}
        </h2>
        {description && (
          <p id={descId} style={{ color: 'var(--text-muted)', fontSize: 'var(--step-0)', marginTop: 0 }}>
            {description}
          </p>
        )}
        <div style={{ marginTop: 'var(--space-3)' }}>{children}</div>
      </div>
    </div>
  );
};

export const SkeletonEntriesList: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading journal observations"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
    >
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="surface-panel">
          <div
            style={{
              width: '120px',
              height: '14px',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-pill)',
              marginBottom: 'var(--space-2)',
            }}
          />
          <div
            style={{
              width: '65%',
              height: '24px',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-1)',
            }}
          />
          <div
            style={{
              width: '90%',
              height: '16px',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        </div>
      ))}
    </div>
  );
};

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastContextValue {
  showToast: (text: string, type?: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          pointerEvents: 'none',
          position: 'fixed',
          bottom: 'var(--space-2)',
          right: 'var(--space-2)',
          zIndex: 70,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          maxWidth: '380px',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="glass edge"
            style={{
              pointerEvents: 'auto',
              padding: 'var(--space-2) var(--space-3)',
              color: t.type === 'error' ? 'var(--danger)' : 'var(--text)',
              fontSize: 'var(--step--1)',
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider.');
  }
  return ctx;
}
