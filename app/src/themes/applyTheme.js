const COLOR_MAP = {
  bgPage: '--bg-page',
  bgSurface: '--bg-surface',
  bgCode: '--bg-code',
  bgMuted: '--bg-muted',
  borderDefault: '--border-default',
  borderLight: '--border-light',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  textAccent: '--text-accent',
  colorSyncEdge: '--color-sync-edge',
  colorAsyncEdge: '--color-async-edge',
};

const FONT_MAP = {
  serif: '--font-serif',
  sans: '--font-sans',
  mono: '--font-mono',
};

const SYNTAX_MAP = {
  keyword: '--syntax-keyword',
  string: '--syntax-string',
  number: '--syntax-number',
  comment: '--syntax-comment',
  variable: '--syntax-variable',
  title: '--syntax-title',
  symbol: '--syntax-symbol',
  meta: '--syntax-meta',
  regexp: '--syntax-regexp',
  deletion: '--syntax-deletion',
  deletionBg: '--syntax-deletion-bg',
  addition: '--syntax-addition',
  additionBg: '--syntax-addition-bg',
  focusLineBg: '--focus-line-bg',
};

export function applyTheme(theme) {
  const root = document.documentElement;

  for (const [key, prop] of Object.entries(COLOR_MAP)) {
    if (theme.colors[key]) root.style.setProperty(prop, theme.colors[key]);
  }

  for (const [key, prop] of Object.entries(FONT_MAP)) {
    if (theme.fonts[key]) root.style.setProperty(prop, theme.fonts[key]);
  }

  for (const [key, prop] of Object.entries(SYNTAX_MAP)) {
    if (theme.syntax[key]) root.style.setProperty(prop, theme.syntax[key]);
  }

  if (theme.overlayBg) root.style.setProperty('--overlay-bg', theme.overlayBg);
  if (theme.shadowColor) root.style.setProperty('--shadow-color', theme.shadowColor);

  root.dataset.theme = theme.id;
}
