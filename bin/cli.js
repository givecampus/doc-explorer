#!/usr/bin/env node

import fs from 'fs';
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
    base: '/',
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

  Options:
    --docs-path <path>   Path to docs directory in repo (default: docs)
    --output <dir>       Output directory for built site (default: _site)
    --base <path>        Base path for assets (default: /)
    -h, --help           Show this help message

  Examples:
    illumina create
    illumina create --docs-path documentation --base /my-repo/
    npx github:marcus-gc/outreach-docs create --base /my-repo/
`);
}

// --- Main ---

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    printUsage();
    process.exit(1);
  }

  if (opts.command !== 'create') {
    console.error(`Unknown command: ${opts.command}`);
    printUsage();
    process.exit(1);
  }

  const callerCwd = process.cwd();
  const dataDir = path.join(PACKAGE_ROOT, 'app', 'src', 'data');

  // Ensure base has trailing slash
  let base = opts.base;
  if (!base.endsWith('/')) base += '/';

  console.log('\n  illumina — building documentation site\n');
  console.log(`  Docs path:  ${opts.docsPath}`);
  console.log(`  Output dir: ${path.resolve(callerCwd, opts.output)}`);
  console.log(`  Base path:  ${base}`);
  console.log('');

  // Step 1: Set env vars for build scripts before importing them
  process.env.LOCAL_REPO_ROOT = callerCwd;
  process.env.DOCS_PATH = opts.docsPath;

  // Step 2: Fetch and parse docs
  console.log('  [1/3] Fetching and parsing docs...\n');
  const { fetchDocs } = await import(path.join(PACKAGE_ROOT, 'build', 'fetch-docs.js'));
  await fetchDocs({
    repoRoot: callerCwd,
    docsPath: opts.docsPath,
    outputDir: dataDir,
  });

  // Step 3: Extract source code snippets
  console.log('\n  [2/3] Extracting source code snippets...\n');
  const { extractSnippets } = await import(path.join(PACKAGE_ROOT, 'build', 'extract-code-snippets.js'));
  await extractSnippets({
    dataDir,
  });

  // Step 4: Run Vite build
  console.log('\n  [3/3] Building static site with Vite...\n');
  const { build } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;

  const appDir = path.join(PACKAGE_ROOT, 'app');
  const outDir = path.resolve(callerCwd, opts.output);

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
    },
    logLevel: 'info',
  });

  console.log(`\n  Done! Static site written to ${outDir}\n`);
}

main().catch((err) => {
  console.error('\n  Build failed:\n');
  console.error(err);
  process.exit(1);
});
