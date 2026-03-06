import React, { useMemo, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';

export default function CommandPalette({ pages }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const pageList = useMemo(() => {
    return Object.entries(pages).map(([route, page]) => ({
      route,
      title: page.title || route,
      description: page.description || '',
      tags: page.tags || [],
      parentRoute: page.parentRoute || '',
    }));
  }, [pages]);

  const fuse = useMemo(() => {
    return new Fuse(pageList, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'tags', weight: 1.5 },
        { name: 'description', weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
  }, [pageList]);

  const results = useMemo(() => {
    if (!search.trim()) return pageList;
    return fuse.search(search).map((r) => r.item);
  }, [search, fuse, pageList]);

  // Group results by parent section
  const grouped = useMemo(() => {
    const groups = {};
    for (const page of results) {
      const section = page.parentRoute || '/';
      if (!groups[section]) groups[section] = [];
      groups[section].push(page);
    }
    return groups;
  }, [results]);

  const sectionLabel = useCallback(
    (parentRoute) => {
      if (parentRoute === '/') return 'Root';
      const parentPage = pages[parentRoute];
      return parentPage?.title || parentRoute;
    },
    [pages]
  );

  const handleSelect = useCallback(
    (route) => {
      navigate(route);
      setOpen(false);
      setSearch('');
    },
    [navigate]
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) setSearch('');
      }}
      label="Search documentation"
      className="cmdk-dialog"
      shouldFilter={false}
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Search pages..."
        className="cmdk-input"
      />
      <Command.List className="cmdk-list">
        <Command.Empty className="cmdk-empty">No pages found.</Command.Empty>
        {Object.entries(grouped).map(([section, items]) => (
          <Command.Group
            key={section}
            heading={sectionLabel(section)}
            className="cmdk-group"
          >
            {items.map((page) => (
              <Command.Item
                key={page.route}
                value={page.route}
                onSelect={() => handleSelect(page.route)}
                className="cmdk-item"
              >
                <div className="cmdk-item-title">{page.title}</div>
                {page.description && (
                  <div className="cmdk-item-description">
                    {page.description}
                  </div>
                )}
                {page.tags.length > 0 && (
                  <div className="cmdk-item-tags">
                    {page.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
