import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import mermaid from 'mermaid';
import NodePopover from './NodePopover';
import SourcePanel from './SourcePanel';

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      primaryColor: '#faf6ee',
      primaryBorderColor: '#d8d0c0',
      primaryTextColor: '#2a2010',
      lineColor: '#b0a890',
      secondaryColor: '#f5f0e6',
      tertiaryColor: '#fdfcf9',
      fontFamily: 'Source Sans 3, sans-serif',
      fontSize: '13px',
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
    },
    sequence: {
      useMaxWidth: true,
    },
  });
  mermaidInitialized = true;
}

// Running counter to avoid Mermaid ID collisions across renders
let renderCounter = 0;

/**
 * Find ALL Mermaid-rendered SVG node elements by the original node ID.
 * Returns an array of elements (may be multiple for sequence diagram participants
 * which appear at both top and bottom of the diagram).
 */
function findNodeElements(container, nodeId, participantMap) {
  const results = [];

  // Strategy 1: Mermaid flowchart pattern "flowchart-{nodeId}-{index}"
  const byFlowchartId = container.querySelector(`[id*="flowchart-${nodeId}-"]`);
  if (byFlowchartId) return [byFlowchartId];

  // Strategy 2: Direct ID match
  const byId = container.querySelector(`#${nodeId}`);
  if (byId) return [byId];

  // Strategy 3: Data-id attribute
  const byDataId = container.querySelector(`[data-id="${nodeId}"]`);
  if (byDataId) return [byDataId];

  // Strategy 4: Sequence diagram participant - search by display name text content
  if (participantMap && participantMap[nodeId]) {
    const displayName = participantMap[nodeId];
    // Mermaid renders participants as <text> elements inside <g> groups
    const textElements = container.querySelectorAll('text');
    const seen = new Set();
    for (const textEl of textElements) {
      const content = textEl.textContent.trim().replace(/\s+/g, ' ');
      // Match if content contains the display name or vice versa
      // (handles multi-line labels where tspans are concatenated)
      if (content && (content.includes(displayName) || displayName.includes(content))) {
        // Navigate to the parent <g> that wraps the participant box
        const group = textEl.closest('g');
        if (group && !seen.has(group)) {
          seen.add(group);
          results.push(group);
        }
      }
    }
    if (results.length > 0) return results;
  }

  // Strategy 5: ID contains the nodeId (broadest match, flowchart fallback)
  const byContains = container.querySelector(`[id*="${nodeId}"]`);
  if (byContains) return [byContains];

  return results;
}

/**
 * Render mermaid SVG into a container and attach click handlers.
 * Shared between inline and fullscreen views.
 *
 * onNodeClick(nodeId, fileRef, anchorEl) — each caller wraps with its own logic.
 */
function renderMermaidInto(container, mermaidId, definition, nodeFiles, participantMap, onNodeClick, setError) {
  initMermaid();
  const renderId = `mermaid-${mermaidId}-${renderCounter++}`;
  const hasClickableNodes = nodeFiles && Object.keys(nodeFiles).length > 0;

  return mermaid
    .render(renderId, definition)
    .then(({ svg }) => {
      if (container) {
        container.innerHTML = svg;

        if (hasClickableNodes) {
          Object.entries(nodeFiles).forEach(([nodeId, fileRef]) => {
            const elements = findNodeElements(container, nodeId, participantMap);
            elements.forEach((nodeEl) => {
              nodeEl.style.cursor = 'pointer';
              nodeEl.classList.add('clickable-node');
              nodeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                onNodeClick(nodeId, fileRef, nodeEl);
              });
            });
          });
        }
      }
    })
    .catch((err) => {
      console.error('Mermaid render error:', err);
      if (setError) setError(err.message || 'Failed to render diagram');
    });
}

function FullscreenOverlay({ id, definition, nodeFiles, participantMap, sourceFiles, activeNodeId, onNodeSelect, onClose }) {
  const containerRef = useRef(null);

  // Refs to avoid stale closures in click handlers attached by renderMermaidInto
  const activeNodeIdRef = useRef(activeNodeId);
  activeNodeIdRef.current = activeNodeId;
  const onNodeSelectRef = useRef(onNodeSelect);
  onNodeSelectRef.current = onNodeSelect;

  const activeFileRef = activeNodeId && nodeFiles ? nodeFiles[activeNodeId] : null;

  // Render diagram into the fullscreen container
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    renderMermaidInto(
      containerRef.current,
      `${id}-fs`,
      definition,
      nodeFiles,
      participantMap,
      (nodeId) => {
        if (!cancelled) {
          if (activeNodeIdRef.current === nodeId) {
            onNodeSelectRef.current(null);
          } else {
            onNodeSelectRef.current(nodeId);
          }
        }
      },
      null
    );

    return () => { cancelled = true; };
  }, [id, definition, nodeFiles, participantMap]);

  // Highlight active node in SVG
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.querySelectorAll('.active-node').forEach((el) => {
      el.classList.remove('active-node');
    });
    if (activeNodeId) {
      const elements = findNodeElements(containerRef.current, activeNodeId, participantMap);
      elements.forEach((el) => el.classList.add('active-node'));
    }
  }, [activeNodeId, participantMap]);

  // Escape key: close source panel first, then fullscreen
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (activeNodeId) {
          onNodeSelect(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, activeNodeId, onNodeSelect]);

  // Lock body scroll while fullscreen is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return ReactDOM.createPortal(
    <div className="diagram-fullscreen-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="diagram-fullscreen-chrome">
        <div className="diagram-fullscreen-toolbar">
          <span className="diagram-fullscreen-hint">
            Click nodes to view source &middot; Esc to close
          </span>
          <button className="diagram-fullscreen-close" onClick={onClose} aria-label="Close fullscreen">
            &times;
          </button>
        </div>
        <div className="diagram-fullscreen-body">
          <div className={`diagram-fullscreen-diagram-pane${activeFileRef ? ' has-source' : ''}`}>
            <div className="diagram-fullscreen-content" ref={containerRef} />
          </div>
          {activeFileRef && (
            <SourcePanel
              fileRef={activeFileRef}
              sourceFiles={sourceFiles}
              onClose={() => onNodeSelect(null)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MermaidDiagram({ id, definition, nodeFiles, participantMap, sourceFiles, isFullscreen, activeNodeId, onFullscreenOpen, onFullscreenClose, onNodeSelect }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [popover, setPopover] = useState(null);

  const hasClickableNodes = nodeFiles && Object.keys(nodeFiles).length > 0;

  const handleClose = useCallback(() => setPopover(null), []);

  useEffect(() => {
    let cancelled = false;

    renderMermaidInto(
      containerRef.current,
      id,
      definition,
      nodeFiles,
      participantMap,
      (nodeId, fileRef, anchorEl) => {
        if (!cancelled) {
          setPopover((prev) => {
            if (prev && prev.nodeId === nodeId) return null;
            return { nodeId, fileRef, anchorEl };
          });
        }
      },
      (msg) => { if (!cancelled) setError(msg); }
    );

    return () => { cancelled = true; };
  }, [id, definition, nodeFiles, participantMap, hasClickableNodes]);

  if (error) {
    return (
      <div className="diagram-container">
        <pre style={{ color: '#9b2c2c', fontSize: '0.85rem' }}>
          Diagram render error: {error}
        </pre>
        <pre
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {definition}
        </pre>
      </div>
    );
  }

  return (
    <div className="diagram-container">
      <button
        className="diagram-expand-btn"
        onClick={() => { setPopover(null); onFullscreenOpen(); }}
        aria-label="Expand diagram"
        title="View fullscreen"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="10,2 14,2 14,6" />
          <polyline points="6,14 2,14 2,10" />
          <line x1="14" y1="2" x2="9.5" y2="6.5" />
          <line x1="2" y1="14" x2="6.5" y2="9.5" />
        </svg>
      </button>
      <div ref={containerRef} />
      {popover && ReactDOM.createPortal(
        <NodePopover
          fileRef={popover.fileRef}
          sourceFiles={sourceFiles}
          anchorEl={popover.anchorEl}
          onClose={handleClose}
        />,
        document.body
      )}
      {isFullscreen && (
        <FullscreenOverlay
          id={id}
          definition={definition}
          nodeFiles={nodeFiles}
          participantMap={participantMap}
          sourceFiles={sourceFiles}
          activeNodeId={activeNodeId}
          onNodeSelect={onNodeSelect}
          onClose={onFullscreenClose}
        />
      )}
    </div>
  );
}
