#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');

// --- Argument parsing ---

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    command: null,
    docsPath: 'docs',
    output: '_site',
    base: './',
    theme: 'warm',
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--docs-path' && args[i + 1]) {
      opts.docsPath = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      opts.output = args[++i];
    } else if (arg === '--base' && args[i + 1]) {
      opts.base = args[++i];
    } else if (arg === '--theme' && args[i + 1]) {
      opts.theme = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (!arg.startsWith('-') && !opts.command) {
      opts.command = arg;
    }
    i++;
  }

  return opts;
}

function printUsage() {
  console.log(`
  illumina — Build a static documentation site from Mermaid-annotated markdown

  Usage:
    illumina create [options]
    illumina view [options]

  Commands:
    create    Build a static site to an output directory
    view      Build to a temp directory, serve it, and open in browser

  Options:
    --docs-path <path>   Path to docs directory in repo (default: docs)
    --output <dir>       Output directory for built site (default: _site, create only)
    --base <path>        Base path for assets (default: ./)
    --theme <id>         Default theme: warm, dark, cool (default: warm)
    -h, --help           Show this help message

  Examples:
    illumina create
    illumina create --docs-path documentation --base /my-repo/
    illumina view
    illumina view --docs-path documentation --theme dark
    npx github:marcus-gc/outreach-docs create --base /my-repo/
`);
}

// --- Build helper ---

async function buildSite({ callerCwd, docsPath, theme, outDir, base }) {
  const dataDir = path.join(PACKAGE_ROOT, 'app', 'src', 'data');

  // Set env vars for build scripts before importing them
  process.env.LOCAL_REPO_ROOT = callerCwd;
  process.env.DOCS_PATH = docsPath;

  // Step 1: Fetch and parse docs
  console.log('  [1/3] Fetching and parsing docs...\n');
  const { fetchDocs } = await import(path.join(PACKAGE_ROOT, 'build', 'fetch-docs.js'));
  await fetchDocs({
    repoRoot: callerCwd,
    docsPath,
    outputDir: dataDir,
  });

  // Step 2: Extract source code snippets
  console.log('\n  [2/3] Extracting source code snippets...\n');
  const { extractSnippets } = await import(path.join(PACKAGE_ROOT, 'build', 'extract-code-snippets.js'));
  await extractSnippets({ dataDir });

  // Step 3: Run Vite build
  console.log('\n  [3/3] Building static site with Vite...\n');
  const { build } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;

  const appDir = path.join(PACKAGE_ROOT, 'app');

  await build({
    root: appDir,
    base,
    plugins: [react()],
    build: {
      outDir,
      emptyOutDir: true,
    },
    define: {
      'import.meta.env.VITE_HASH_ROUTER': JSON.stringify('true'),
      'import.meta.env.VITE_DEFAULT_THEME': JSON.stringify(theme),
    },
    logLevel: 'info',
  });
}

// --- Main ---

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    printUsage();
    process.exit(1);
  }

  if (opts.command !== 'create' && opts.command !== 'view') {
    console.error(`Unknown command: ${opts.command}`);
    printUsage();
    process.exit(1);
  }

  const callerCwd = process.cwd();

  // Ensure base has trailing slash
  let base = opts.base;
  if (!base.endsWith('/')) base += '/';

  if (opts.command === 'create') {
    const outDir = path.resolve(callerCwd, opts.output);

    console.log('\n  illumina — building documentation site\n');
    console.log(`  Docs path:  ${opts.docsPath}`);
    console.log(`  Output dir: ${outDir}`);
    console.log(`  Base path:  ${base}`);
    console.log(`  Theme:      ${opts.theme}`);
    console.log('');

    await buildSite({ callerCwd, docsPath: opts.docsPath, theme: opts.theme, outDir, base });

    console.log(`\n  Done! Static site written to ${outDir}\n`);
  }

  if (opts.command === 'view') {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'illumina-'));

    const cleanup = () => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    };
    process.on('SIGINT', () => { cleanup(); process.exit(0); });
    process.on('SIGTERM', () => { cleanup(); process.exit(0); });

    console.log('\n  illumina — building and previewing documentation site\n');
    console.log(`  Docs path:  ${opts.docsPath}`);
    console.log(`  Theme:      ${opts.theme}`);
    console.log('');

    try {
      await buildSite({ callerCwd, docsPath: opts.docsPath, theme: opts.theme, outDir: tmpDir, base: './' });
    } catch (err) {
      cleanup();
      throw err;
    }

    console.log('\n  Starting preview server...\n');

    const { preview } = await import('vite');

    // Wire chat middleware if API key is available
    const plugins = [];
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { chatPlugin } = await import(path.join(PACKAGE_ROOT, 'server', 'chat.js'));
        plugins.push(chatPlugin());
        console.log('  Chat enabled (ANTHROPIC_API_KEY found)\n');
      } catch (err) {
        console.warn('  Chat plugin failed to load:', err.message);
      }
    }

    const server = await preview({
      configFile: false,
      root: tmpDir,
      build: { outDir: '.' },
      preview: { open: true },
      plugins,
    });

    server.printUrls();
    server.bindCLIShortcuts({ print: true });
  }
}

main().catch((err) => {
  console.error('\n  Build failed:\n');
  console.error(err);
  process.exit(1);
});
