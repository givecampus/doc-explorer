---
title: Writing Documentation Pages
description: How to author markdown pages with frontmatter, prose, and interactive mermaid diagrams.
tags: [authoring, markdown, mermaid, writing, guide]
---

## Prerequisites

- A target repo with a `docs/` directory (or whatever `DOCS_PATH` is set to)
- Understanding of basic Mermaid syntax

## Page Structure

Every documentation page is a markdown file with three parts: frontmatter, prose, and optional mermaid diagrams.

```markdown
---
title: My Page Title
description: Short description for index cards
tags: [relevant, keywords]
---

## Overview

Regular markdown prose here...

## Diagram Section

` ``mermaid
flowchart TD
  A[Step 1] --> B[Step 2]
  click A href "#" "app/controllers/foo.rb:15-30"
  click B href "#" "app/services/bar.rb"
` ``

More prose after the diagram...
```

## Frontmatter

YAML frontmatter is required at the top of every file:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Page title, displayed as h1 and in nav cards |
| `description` | No | Shown on parent index page cards |
| `tags` | No | Array of keywords, displayed as badges on cards |

If `title` is missing, the build falls back to the first `# Heading` in the body.

## File Placement and Routing

Where you place the file determines its URL route:

| File location | URL route | Page type |
|--------------|-----------|-----------|
| `docs/index.md` | `/` | Root index |
| `docs/topic/index.md` | `/topic` | Section index (shows child cards) |
| `docs/topic/page.md` | `/topic/page` | Leaf page |
| `docs/topic/sub/deep.md` | `/topic/sub/deep` | Deep nested page |

Index files (`index.md`) automatically render cards for all child pages in their directory. You don't need to manually list them.

If a directory has child pages but no `index.md`, the build synthesizes one with a title derived from the directory name.

## Mermaid Diagrams

### Basic Flowchart

```markdown
` ``mermaid
flowchart TD
  A[First Step] --> B[Second Step]
  B --> C{Decision}
  C -->|Yes| D[Do This]
  C -->|No| E[Do That]
` ``
```

### Adding Click Directives

Click directives link diagram nodes to source code. They must follow this exact format:

```
click NodeID href "#" "path/to/file.rb:startLine-endLine"
```

Rules:
- `href "#"` is mandatory and literal — do not change it
- Paths are relative to the **repository root**, not the docs folder
- Line ranges need both start and end: `:10-25`
- For a single line: `:10-10`
- Omit the range to reference the whole file
- Place click directives at the end of the mermaid block

### Sequence Diagrams

Sequence diagrams require `participant ALIAS as Display Name` for click matching:

```markdown
` ``mermaid
sequenceDiagram
  participant C as Controller
  participant S as Service
  participant M as Model
  C->>S: call service
  S->>M: update record
  M-->>S: saved
  S-->>C: result
  click C href "#" "app/controllers/things_controller.rb:10-25"
  click S href "#" "app/services/thing_service.rb"
  click M href "#" "app/models/thing.rb"
` ``
```

The `as` alias is how the frontend matches click handlers to the rendered SVG nodes.

## Internal Links

Link to other doc pages using relative paths without the `.md` extension:

```markdown
See the [setup guide](../how_tos/setup) for installation steps.
Check out [Build Pipeline](../key_concepts/build_pipeline) for details.
```

Links are resolved relative to the current page's directory. The `MarkdownRenderer` component converts them to React Router `<Link>` components for client-side navigation.

## Tips

- Keep diagrams focused — one concept per diagram, not the entire system
- Use descriptive node labels that match the code concepts they reference
- Add click directives to the most important nodes, not every node
- Test locally with `npm run dev` to verify diagrams render and clicks work
- Use `npm run dev:cached` during writing to avoid rebuilding on every refresh
