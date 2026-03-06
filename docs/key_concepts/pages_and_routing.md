---
title: Pages & Routing
description: How markdown file paths become URL routes, and how the nav tree is built from parent-child relationships.
tags: [pages, routing, navigation, nav-tree]
---

## Overview

Doc Viewer uses file-system routing. The directory structure of markdown files in the target repo directly determines the URL routes in the frontend. There is no route configuration file — routes are derived automatically during the build step.

```mermaid
flowchart TD
  A[docs/index.md] -->|route: /| E[pages.json]
  B[docs/outreach/index.md] -->|route: /outreach| E
  C[docs/outreach/create.md] -->|route: /outreach/create| E
  D[docs/outreach/send.md] -->|route: /outreach/send| E
  E --> F[navTree]
  F --> G[DocPage renders\nbreadcrumbs + children]
  click E href "#" "build/fetch-docs.js:413-414"
  click F href "#" "build/fetch-docs.js:230-268"
  click G href "#" "app/src/components/DocPage.jsx:32-114"
```

## Route Derivation

The `fileToRoute()` function converts a relative file path to a URL route:

| File path | Route |
|-----------|-------|
| `index.md` | `/` |
| `outreach/index.md` | `/outreach` |
| `outreach/create.md` | `/outreach/create` |
| `outreach/workflows/foo.md` | `/outreach/workflows/foo` |

Rules:
- `.md` extension is stripped
- `index` files map to their parent directory path
- All routes start with `/`

```mermaid
flowchart LR
  A[fileToRoute] --> B[Strip .md]
  B --> C[Remove /index suffix]
  C --> D[Prepend /]
  click A href "#" "build/fetch-docs.js:212-226"
```

## Parent-Child Relationships

Each page has a `parentRoute` derived from its URL path. For `/outreach/create`, the parent is `/outreach`. This creates a hierarchy used for:

- **Breadcrumb navigation** — `buildBreadcrumbs()` walks up the parent chain
- **Index page child cards** — `getChildren()` finds pages whose `parentRoute` matches the current route
- **Nav tree grouping** — `buildNavTree()` nests pages under their parents

## Synthesized Index Pages

If a directory contains child pages but no `index.md`, the build automatically creates a synthetic index page. The title is derived from the directory name (capitalized, underscores to spaces). This ensures every parent route resolves to a page.

## Page Object Shape

Each page in `pages.json` contains:

```json
{
  "route": "/outreach/create",
  "title": "Creating an Outreach",
  "description": "How the outreach creation flow works",
  "tags": ["outreach", "controllers"],
  "isIndex": false,
  "parentRoute": "/outreach",
  "sourcePath": "docs/outreach/create.md",
  "sections": [
    { "type": "prose", "content": "## Overview\n..." },
    { "type": "mermaid", "id": "flowchart", "definition": "...", "nodeFiles": {} }
  ]
}
```

## Frontend Routing

The React app uses a single catch-all `<Route path="*">` that renders `DocPage`. DocPage reads the current URL via `useLocation()`, looks up the matching page object, and renders it. If no page matches, it redirects to the first route in the nav tree.

```mermaid
flowchart LR
  A[URL pathname] --> B[DocPage]
  B --> C{Page exists?}
  C -->|Yes| D[Render breadcrumbs\n+ sections + children]
  C -->|No| E[Redirect to\nfirst route]
  click B href "#" "app/src/components/DocPage.jsx:32-46"
  click D href "#" "app/src/components/DocPage.jsx:51-113"
```
