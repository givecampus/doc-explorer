import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import './styles/theme.css';
import { getTheme, getInitialThemeId } from './themes/index.js';
import { applyTheme } from './themes/applyTheme.js';

// Apply theme before first render to prevent flash of wrong theme
applyTheme(getTheme(getInitialThemeId()));

const Router = import.meta.env.VITE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
