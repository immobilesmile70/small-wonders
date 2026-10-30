import React from 'react';
import { ToastProvider } from '../components/ui/Primitives';
import { AuthProvider } from '../features/auth/AuthContext';
import { JournalProvider } from '../features/journal/JournalContext';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      <AuthProvider>
        <JournalProvider>{children}</JournalProvider>
      </AuthProvider>
    </ToastProvider>
  );
};
