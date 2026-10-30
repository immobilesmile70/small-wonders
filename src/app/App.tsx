import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './providers';
import { AppRouter } from './router';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('sw_theme_pref');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Default to Midnight Obsidian dark theme per premium-design
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('sw_theme_pref', theme);
    } catch {
      // Safe fallback
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter theme={theme} onToggleTheme={handleToggleTheme} />
      </AppProviders>
    </BrowserRouter>
  );
};

export default App;
