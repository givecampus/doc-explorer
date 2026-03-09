import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import MarkdownRenderer from './MarkdownRenderer';
import { editorUrl } from './editorUtils';
import { sendMessage } from '../lib/chatApi';

const EDITOR_STORAGE_KEY = 'docs-editor-preference';
const REPO_PATH_STORAGE_KEY = 'docs-repo-path';

function CitationLink({ href, children }) {
  const editor = localStorage.getItem(EDITOR_STORAGE_KEY) || 'vscode';
  const repoPath = localStorage.getItem(REPO_PATH_STORAGE_KEY) || '';

  // Source file citation: source://filepath:lines
  if (href && href.startsWith('source://')) {
    const raw = href.slice('source://'.length);
    const fileRef = raw;
    const [filePath, lineRange] = fileRef.split(':');
    const startLine = lineRange ? parseInt(lineRange.split('-')[0], 10) : 1;

    if (repoPath) {
      const url = editorUrl(editor, repoPath, filePath, startLine);
      return (
        <a href={url} className="chat-citation chat-citation--source" title={`Open ${fileRef} in editor`}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5l-3-3z" />
            <polyline points="10 2 10 5 13 5" />
          </svg>
          {children}
        </a>
      );
    }

    return <span className="chat-citation chat-citation--source">{children}</span>;
  }

  // Doc page citation: internal route link
  if (href && href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link to={href} className="chat-citation chat-citation--page">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h12v10H2z" />
          <path d="M5 3V1h6v2" />
          <line x1="5" y1="7" x2="11" y2="7" />
          <line x1="5" y1="10" x2="9" y2="10" />
        </svg>
        {children}
      </Link>
    );
  }

  // External or other links
  if (href && /^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  }

  return <a href={href}>{children}</a>;
}

function ChatMessage({ message, currentRoute }) {
  if (message.role === 'user') {
    return (
      <div className="chat-message chat-message--user">
        <div className="chat-message-bubble">{message.content}</div>
      </div>
    );
  }

  // AI message — render as markdown with citation handling
  const components = {
    a({ href, children, ...rest }) {
      return <CitationLink href={href}>{children}</CitationLink>;
    },
  };

  return (
    <div className="chat-message chat-message--ai">
      <MarkdownRenderer
        content={message.content}
        currentRoute={currentRoute}
        linkComponent={CitationLink}
      />
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  'What does this page document?',
  'How does the build pipeline work?',
  'What source files are referenced here?',
];

export default function ChatPanel({ open, onClose, currentRoute, pages }) {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState('');
  const [noApiKey, setNoApiKey] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Current page info for suggested questions
  const currentPage = pages
    ? Object.values(pages).find((p) => p.route === currentRoute)
    : null;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      // Focus input after panel opens
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const sendChat = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    setError(null);
    setNoApiKey(false);

    const userMsg = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Add placeholder for AI response
    const aiMsg = { role: 'assistant', content: '' };
    setMessages([...newMessages, aiMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const stream = sendMessage(
        newMessages.map(({ role, content }) => ({ role, content })),
        currentRoute,
        controller.signal,
      );

      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages([...newMessages, { role: 'assistant', content: fullText }]);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.message?.includes('not configured')) {
        setNoApiKey(true);
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, currentRoute]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendChat(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat(input);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="chat-panel">
      <div className="chat-panel-header">
        <span className="chat-panel-title">Ask about this codebase</span>
        <button className="chat-panel-close" onClick={onClose} aria-label="Close chat">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !noApiKey && (
          <div className="chat-empty">
            <p className="chat-empty-title">
              {currentPage ? `Viewing: ${currentPage.title}` : 'Ask a question'}
            </p>
            <div className="chat-suggestions">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="chat-suggestion"
                  onClick={() => sendChat(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {noApiKey && (
          <div className="chat-notice">
            <p><strong>API key not configured</strong></p>
            <p>Add <code>ANTHROPIC_API_KEY=your-key</code> to your <code>.env</code> file and restart the dev server.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} currentRoute={currentRoute} />
        ))}

        {streaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="chat-typing">
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
            <span className="chat-typing-dot" />
          </div>
        )}

        {error && (
          <div className="chat-error">
            <p>{error}</p>
            <button
              className="chat-retry-btn"
              onClick={() => {
                setError(null);
                const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUser) {
                  // Remove the failed AI message and retry
                  setMessages(messages.filter((m) => m.role === 'user'));
                  sendChat(lastUser.content);
                }
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          rows={1}
          disabled={streaming || noApiKey}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={streaming || !input.trim() || noApiKey}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="14" x2="8" y2="3" />
            <polyline points="3 7 8 2 13 7" />
          </svg>
        </button>
      </form>
    </div>,
    document.body,
  );
}
