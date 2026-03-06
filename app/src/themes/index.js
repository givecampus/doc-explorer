import warm from './warm.js';
import dark from './dark.js';
import cool from './cool.js';
import ezekiel from './ezekiel.js';

export const THEMES = { warm, dark, cool, ezekiel };

export const DEFAULT_THEME_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEFAULT_THEME) || 'warm';

export const THEME_STORAGE_KEY = 'docs-theme';

export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME_ID] || warm;
}

export function getInitialThemeId() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEMES[stored]) return stored;
  } catch {}
  return DEFAULT_THEME_ID;
}
