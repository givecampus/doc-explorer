import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import DocPage from './components/DocPage';
import CommandPalette from './components/CommandPalette';
import pagesData from './data/pages.json';
import { THEMES, getTheme, getInitialThemeId, THEME_STORAGE_KEY } from './themes/index.js';
import { applyTheme } from './themes/applyTheme.js';
import { ThemeContext } from './ThemeContext.js';

const { pages, navTree } = pagesData;

const EDITORS = [
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'webstorm', label: 'WebStorm' },
  { id: 'rubymine', label: 'RubyMine' },
  { id: 'sublime', label: 'Sublime Text' },
  { id: 'mvim', label: 'Vim (MacVim)' },
];

const EDITOR_STORAGE_KEY = 'docs-editor-preference';
const REPO_PATH_STORAGE_KEY = 'docs-repo-path';

function EditorSelector({ themeId, onThemeChange }) {
  const [open, setOpen] = useState(false);
  const [editor, setEditor] = useState(() => localStorage.getItem(EDITOR_STORAGE_KEY) || 'vscode');
  const [repoPath, setRepoPath] = useState(() => localStorage.getItem(REPO_PATH_STORAGE_KEY) || '');
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectEditor = (id) => {
    setEditor(id);
    localStorage.setItem(EDITOR_STORAGE_KEY, id);
  };

  const handleRepoPathChange = (e) => {
    const value = e.target.value;
    setRepoPath(value);
    localStorage.setItem(REPO_PATH_STORAGE_KEY, value);
  };

  const current = EDITORS.find((e) => e.id === editor) || EDITORS[0];

  return (
    <div className="editor-selector" ref={ref}>
      <button
        className="editor-selector-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        title="Settings"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
        </svg>
      </button>
      {open && (
        <div className="editor-selector-dropdown">
          <div className="editor-selector-section-label">Theme</div>
          {Object.values(THEMES).map((t) => (
            <button
              key={t.id}
              className={`editor-selector-option${t.id === themeId ? ' active' : ''}`}
              onClick={() => onThemeChange(t.id)}
            >
              {t.label}
              {t.id === themeId && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              )}
            </button>
          ))}
          <div className="editor-selector-divider" />
          <div className="editor-selector-section-label">Editor</div>
          {EDITORS.map((e) => (
            <button
              key={e.id}
              className={`editor-selector-option${e.id === editor ? ' active' : ''}`}
              onClick={() => selectEditor(e.id)}
            >
              {e.label}
              {e.id === editor && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              )}
            </button>
          ))}
          <div className="editor-selector-divider" />
          <div className="editor-selector-section-label">Local repo path</div>
          <div className="editor-selector-input-wrapper">
            <input
              type="text"
              className="editor-selector-input"
              value={repoPath}
              onChange={handleRepoPathChange}
              placeholder="/path/to/givecampus"
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Derive header title from first root nav node
const headerTitle = navTree.length > 0 ? navTree[0].title : 'Documentation';

export default function App() {
  const { pathname } = useLocation();
  const [themeId, setThemeId] = useState(getInitialThemeId);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useEffect(() => {
    document.title = headerTitle;
  }, []);

  const selectTheme = (id) => {
    setThemeId(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    applyTheme(getTheme(id));
  };

  return (
    <ThemeContext.Provider value={{ themeId }}>
      <div className="app-layout">
        <header className="app-header">
          <Link to="/">
            <h1 className="app-header-title">{headerTitle}</h1>
            <p className="app-header-subtitle">
              Architecture documentation
            </p>
          </Link>
          <EditorSelector themeId={themeId} onThemeChange={selectTheme} />
        </header>
        <CommandPalette pages={pages} />

        <main className="app-main">
          <Routes>
            <Route
              path="*"
              element={<DocPage pages={pages} navTree={navTree} />}
            />
          </Routes>
        </main>
      </div>
    </ThemeContext.Provider>
  );
}
