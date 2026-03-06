import React, { useMemo, useState } from 'react';
import CodeBlock from './CodeBlock';
import { editorUrl } from './editorUtils';

const MAX_FULL_FILE_LINES = 100;
const CONTEXT_LINES = 2;

export default function SourcePanel({ fileRef, sourceFiles, onClose }) {
  const { file, startLine, endLine } = fileRef;
  const fileData = sourceFiles?.[file];

  const snippet = useMemo(() => {
    if (!fileData?.content) return null;
    const lines = fileData.content.split('\n');
    if (!startLine) {
      if (lines.length > MAX_FULL_FILE_LINES) {
        return {
          code: lines.slice(0, MAX_FULL_FILE_LINES).join('\n') + '\n\n// ... truncated ...',
          contextStartLine: 1,
          focusStartLine: 1,
          focusEndLine: MAX_FULL_FILE_LINES,
          truncated: true,
          totalLines: lines.length,
        };
      }
      return {
        code: fileData.content,
        contextStartLine: 1,
        focusStartLine: 1,
        focusEndLine: lines.length,
      };
    }
    const ctxStart = Math.max(0, startLine - 1 - CONTEXT_LINES);
    const ctxEnd = Math.min(lines.length, endLine + CONTEXT_LINES);
    return {
      code: lines.slice(ctxStart, ctxEnd).join('\n'),
      contextStartLine: ctxStart + 1,
      focusStartLine: startLine,
      focusEndLine: endLine,
    };
  }, [fileData, startLine, endLine]);

  const [editor] = useState(() => localStorage.getItem('docs-editor-preference') || 'vscode');
  const repoPath = localStorage.getItem('docs-repo-path') || '';
  const href = repoPath ? editorUrl(editor, repoPath, file, startLine || 1) : null;

  return (
    <div className="source-panel">
      <header className="source-panel-header">
        <div className="source-panel-file-info">
          {href ? (
            <a className="source-panel-file-path" href={href} title="Open in editor">
              {file}
            </a>
          ) : (
            <span className="source-panel-file-path" title="Set repo path in settings to enable editor links">
              {file}
            </span>
          )}
          {startLine && (
            <span className="source-panel-line-range">
              L{startLine}&ndash;{endLine}
            </span>
          )}
        </div>
        <button className="source-panel-close" onClick={onClose} aria-label="Close panel">
          &times;
        </button>
      </header>

      {fileData?.language && (
        <div className="source-panel-language">{fileData.language}</div>
      )}

      {snippet ? (
        <div className="source-panel-code-wrapper">
          <CodeBlock
            code={snippet.code}
            language={fileData?.language}
            contextStartLine={snippet.contextStartLine}
            focusStartLine={snippet.focusStartLine}
            focusEndLine={snippet.focusEndLine}
          />
        </div>
      ) : fileData?.error ? (
        <div className="source-panel-error">File not found in repository</div>
      ) : (
        <div className="source-panel-error">No code snippet available</div>
      )}

      {snippet?.truncated && (
        <div className="source-panel-truncated">
          Showing first {snippet.focusEndLine} of {snippet.totalLines} lines
        </div>
      )}
    </div>
  );
}
