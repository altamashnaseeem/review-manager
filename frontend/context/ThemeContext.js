'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY, validTheme } from '../lib/theme';

const ThemeContext = createContext(null);
function applyTheme(theme) {
  const root = document.documentElement;
  // Keep hover transitions from flashing light controls during a mode change.
  root.dataset.themeChanging = '';
  root.dataset.theme = theme;
  void window.getComputedStyle(document.body).backgroundColor;
  requestAnimationFrame(() => requestAnimationFrame(() => { delete root.dataset.themeChanging; }));
}
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(validTheme(current) ? current : 'dark');
    const sync = event => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const next = validTheme(event.newValue) ? event.newValue : 'dark';
      applyTheme(next);
      setTheme(next);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* The switch still works when storage is blocked. */ }
  }, []);
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
