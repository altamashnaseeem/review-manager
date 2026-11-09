'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="theme-toggle">
    <Sun size={17} className="theme-sun" aria-hidden="true" />
    <Moon size={17} className="theme-moon" aria-hidden="true" />
  </button>;
}
