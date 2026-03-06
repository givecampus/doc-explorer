import React, { useState, useEffect } from 'react';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractHeadings(sections) {
  const headings = [];
  for (const section of sections) {
    if (section.type !== 'prose') continue;
    const lines = section.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(#{2,4})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        headings.push({ level, text, id: slugify(text) });
      }
    }
  }
  return headings;
}

export default function TableOfContents({ sections }) {
  const [activeId, setActiveId] = useState(null);
  const headings = extractHeadings(sections);

  useEffect(() => {
    if (headings.length === 0) return;

    const ids = headings.map((h) => h.id);

    const handleScroll = () => {
      // Walk from the bottom up; the last heading at or above scroll threshold is active
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveId(ids[i]);
          return;
        }
      }
      setActiveId(ids[0] ?? null);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings.map((h) => h.id).join(',')]);

  if (headings.length < 2) return null;

  const handleClick = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  return (
    <nav className="toc" aria-label="Table of contents">
      <div className="toc-label">On this page</div>
      <ul className="toc-list">
        {headings.map(({ level, text, id }) => (
          <li key={id} className={`toc-item toc-item--h${level}`}>
            <a
              href={`#${id}`}
              className={`toc-link${activeId === id ? ' toc-link--active' : ''}`}
              onClick={(e) => handleClick(e, id)}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
