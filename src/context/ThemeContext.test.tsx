// @vitest-environment jsdom

import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

const THEME_STORAGE_KEY = 'dgc_jp_theme';

const Consumer = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
};

const renderTheme = () => render(<ThemeProvider><Consumer /></ThemeProvider>);
const themeButton = () => screen.getByRole('button');

// ThemeProvider saves the current theme on every render, and unmounting (cleanup) does not clear
// localStorage, so each test sets the saved value and the OS preference it expects explicitly.
type SavedTheme = { kind: 'none' } | { kind: 'value'; value: string };
type OsPreference = 'dark' | 'light' | 'unavailable';

const setSavedTheme = (saved: SavedTheme) => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  if (saved.kind === 'value') localStorage.setItem(THEME_STORAGE_KEY, saved.value);
};

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

const restoreMatchMedia = () => {
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else delete (window as { matchMedia?: unknown }).matchMedia;
};

const setOsPreference = (preference: OsPreference) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: preference === 'unavailable' ? undefined : vi.fn((query: string) => ({ matches: preference === 'dark' && query === '(prefers-color-scheme: dark)', media: query })),
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  restoreMatchMedia();
  document.documentElement.classList.remove('dark');
  localStorage.removeItem(THEME_STORAGE_KEY);
});

describe('ThemeProvider initial theme with a valid saved theme', () => {
  it('uses a valid saved theme', () => {
    setSavedTheme({ kind: 'value', value: 'dark' });
    setOsPreference('unavailable');
    renderTheme();
    expect(themeButton()).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('prefers a valid saved theme over the OS preference', () => {
    setSavedTheme({ kind: 'value', value: 'light' });
    setOsPreference('dark');
    renderTheme();
    expect(themeButton()).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

describe('ThemeProvider initial theme without a valid saved theme', () => {
  const savedStates: Array<[string, SavedTheme]> = [
    ['nothing saved', { kind: 'none' }],
    ['an invalid saved value', { kind: 'value', value: 'unexpected' }],
  ];
  const cases: Array<[OsPreference, 'dark' | 'light']> = [
    ['dark', 'dark'],
    ['light', 'light'],
    ['unavailable', 'light'],
  ];

  describe.each(savedStates)('with %s', (_label, saved) => {
    it.each(cases)('uses the OS preference (%s) and starts %s', (osPreference, expected) => {
      setSavedTheme(saved);
      setOsPreference(osPreference);
      renderTheme();
      expect(themeButton()).toHaveTextContent(expected);
      expect(document.documentElement.classList.contains('dark')).toBe(expected === 'dark');
    });
  });
});

describe('ThemeProvider when browser storage is unavailable', () => {
  const blockRead = () => vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Storage access denied', 'SecurityError');
  });
  const blockWrite = () => vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage access denied', 'SecurityError');
  });

  it('starts from the OS preference when reading the saved theme throws, and still toggles', () => {
    setSavedTheme({ kind: 'none' });
    setOsPreference('dark');
    blockRead();
    renderTheme();
    expect(themeButton()).toHaveTextContent('dark');

    fireEvent.click(themeButton());
    expect(themeButton()).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('starts light when reading throws and no OS preference is available, and still toggles', () => {
    setSavedTheme({ kind: 'none' });
    setOsPreference('unavailable');
    blockRead();
    renderTheme();
    expect(themeButton()).toHaveTextContent('light');

    fireEvent.click(themeButton());
    expect(themeButton()).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('keeps toggling when saving the theme throws', () => {
    setSavedTheme({ kind: 'none' });
    setOsPreference('unavailable');
    blockRead();
    blockWrite();
    renderTheme();

    fireEvent.click(themeButton());
    expect(themeButton()).toHaveTextContent('dark');
    fireEvent.click(themeButton());
    expect(themeButton()).toHaveTextContent('light');
  });
});
