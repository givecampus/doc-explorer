---
title: Build & Render Pipeline
description: End-to-end workflow from markdown file to rendered page with interactive diagrams.
tags: [build, render, pipeline, workflow]
---

## Overview

This workflow traces a documentation page from its markdown source in the target repo through the build pipeline and into the browser as a fully rendered page with interactive diagrams.

## Full Pipeline

```mermaid
sequenceDiagram
  participant FD as fetch-docs.js
  participant ENV as lib/env.js
  participant ECS as extract-code-snippets.js
  participant APP as App.jsx
  participant DP as DocPage
  participant MD as MermaidDiagram

  FD->>ENV: discoverLocalFiles or discoverRemoteFiles
  ENV-->>FD: list of .md relative paths
  FD->>ENV: fetchFileContent for each .md
  ENV-->>FD: raw markdown content
  FD->>FD: parseMarkdownContent (frontmatter + sections)
  FD->>FD: fileToRoute + buildNavTree
  FD->>FD: write pages.json

  ECS->>ECS: read pages.json, collect file refs
  ECS->>ENV: fetchFileContent for each source file
  ENV-->>ECS: full file content
  ECS->>ECS: write source-files.json

  APP->>APP: import pages.json
  APP->>DP: pass pages + navTree
  DP->>DP: lookup page by route
  DP->>DP: render breadcrumbs + prose sections
  DP->>MD: pass mermaid definition + nodeFiles + sourceFiles
  MD->>MD: mermaid.render to SVG
  MD->>MD: attach click handlers

  click FD href "#" "build/fetch-docs.js:272-416"
  click ENV href "#" "build/lib/env.js:74-89"
  click ECS href "#" "build/extract-code-snippets.js:27-86"
  click APP href "#" "app/src/App.jsx:98-131"
  click DP href "#" "app/src/components/DocPage.jsx:32-114"
  click MD href "#" "app/src/components/MermaidDiagram.jsx:201-282"
```

## Step-by-Step Breakdown

### 1. File Discovery

`fetch-docs.js` calls either `discoverLocalFiles()` (filesystem walk) or `discoverRemoteFiles()` (GitHub API) depending on whether `LOCAL_REPO_ROOT` is set. Both return an array of relative paths like `["index.md", "outreach/create.md"]`.

### 2. Markdown Parsing

For each discovered file, `fetchFileContent()` retrieves the raw markdown. `parseMarkdownContent()` then:

1. Extracts YAML frontmatter with `gray-matter`
2. Splits the body at mermaid code fences
3. For each mermaid block: extracts click directives into `nodeFiles`, captures participant aliases, strips click lines from the definition
4. Everything between mermaid blocks becomes prose sections

### 3. Route & Nav Tree Generation

`fileToRoute()` converts each relative path to a URL route. The build then:

1. Computes `parentRoute` from the route hierarchy
2. Synthesizes index pages for directories that have children but no `index.md`
3. `buildNavTree()` creates a nested tree structure from the flat page map

### 4. Source File Extraction

`extract-code-snippets.js` reads the generated `pages.json`, collects every unique file path from all `nodeFiles` entries, and fetches each file in full. The output maps file paths to `{ language, totalLines, content }`.

### 5. Frontend Rendering

The React app imports both JSON files at build time (Vite handles this as static imports). When a user navigates to a route:

1. `App.jsx` renders the router with a catch-all route
2. `DocPage` looks up the page by pathname, builds breadcrumbs, and iterates over sections
3. Prose sections go to `MarkdownRenderer` (react-markdown + GFM + rehype-raw)
4. Mermaid sections go to `MermaidDiagram`, which renders SVG and wires up click handlers
5. Index pages additionally render child page cards below the content

### 6. Diagram Interaction

After SVG rendering, `MermaidDiagram` walks the `nodeFiles` map and calls `findNodeElements()` for each node ID. Matched elements get a click handler that toggles the `NodePopover` with the file reference. See [Diagram Interaction](diagram_interaction) for the full click-to-popover flow.
