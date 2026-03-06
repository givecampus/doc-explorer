---
title: Setup Guide
description: How to install, configure, and run Doc Viewer against any repository.
tags: [setup, install, configuration, getting-started]
---

## Prerequisites

- Node.js 18+
- A target repository with markdown docs (or this project itself for testing)

## Installation

```bash
# Clone the project
git clone <repo-url> && cd outreach-docs

# Install build dependencies
cd build && npm install

# Install app dependencies
cd ../app && npm install
```

## Configuration

Create a `.env` file at the project root. See `.env.example` for the template.

### Local Mode (recommended for development)

Point to a local clone of the target repo:

```bash
LOCAL_REPO_ROOT=/path/to/target-repo
DOCS_PATH=docs
```

The build will read markdown files from `{LOCAL_REPO_ROOT}/{DOCS_PATH}/` using the filesystem.

### Remote Mode

Fetch docs from GitHub (useful for CI or when you don't have a local clone):

```bash
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
GITHUB_REF=main
DOCS_PATH=docs
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOCAL_REPO_ROOT` | One of these | — | Path to local repo clone |
| `GITHUB_TOKEN` | One of these | — | GitHub personal access token |
| `GITHUB_OWNER` | For remote | `givecampus` | GitHub organization/owner |
| `GITHUB_REPO` | For remote | `givecampus` | Repository name |
| `GITHUB_REF` | For remote | `staging` | Branch, tag, or commit SHA |
| `DOCS_PATH` | No | `docs` | Subdirectory where markdown files live |

## Running

All commands run from the `app/` directory:

```bash
# Full build + dev server
npm run dev

# Dev server only (skip rebuild, use cached JSON)
npm run dev:cached

# Production build
npm run build

# Just run build scripts without starting Vite
npm run parse
```

The dev server runs on `http://localhost:3100`.

## Editor Integration

Once the app is running:

1. Click the gear icon in the top-right header
2. Select your preferred editor (VS Code, Cursor, WebStorm, etc.)
3. Enter the absolute path to your local repo clone (e.g. `/Users/you/code/givecampus`)

This enables clickable file paths in source code popovers that open directly in your editor.

## Self-Documentation Mode

To use Doc Viewer to document itself:

```bash
# In .env, point to this project
LOCAL_REPO_ROOT=/path/to/outreach-docs
DOCS_PATH=docs
```

Then run `npm run dev` from `app/`. The viewer will render its own documentation with diagrams linking to its own source code.
