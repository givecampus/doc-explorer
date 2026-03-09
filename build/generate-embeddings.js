#!/usr/bin/env node

/**
 * Optional build step: generates embeddings.json for RAG mode.
 * Chunks pages + source files, embeds via Voyage AI, outputs vector index.
 *
 * Run: npm run embeddings (from app/)
 * Requires: VOYAGE_API_KEY in .env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load .env
const envPath = path.resolve(PROJECT_ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  console.log('\n  VOYAGE_API_KEY not set in .env — skipping embeddings generation.');
  console.log('  RAG mode is optional. The chat will use full-context mode instead.\n');
  process.exit(0);
}

const DATA_DIR = path.resolve(PROJECT_ROOT, 'app', 'src', 'data');
const CHUNK_SIZE = 500; // approximate tokens per chunk
const OVERLAP = 50; // overlap tokens between source file chunks
const BATCH_SIZE = 64; // Voyage AI supports batch embedding
const CONCURRENCY = 5;

function loadJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) {
    console.error(`  ${filename} not found. Run 'npm run parse' first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

// Rough token count (words ~= tokens * 0.75)
function approxTokens(text) {
  return Math.ceil(text.split(/\s+/).length / 0.75);
}

function chunkText(text, maxTokens, overlap = 0) {
  const words = text.split(/\s+/);
  const wordsPerChunk = Math.floor(maxTokens * 0.75);
  const overlapWords = Math.floor(overlap * 0.75);
  const chunks = [];

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start = end - overlapWords;
    if (start >= words.length || end === words.length) break;
  }

  return chunks;
}

function buildChunks(pagesData, sourceFiles) {
  const chunks = [];

  // Chunk documentation pages
  const pages = pagesData.pages || {};
  for (const page of Object.values(pages)) {
    // Collect all prose content
    let proseContent = '';
    const mermaidChunks = [];

    for (const section of page.sections || []) {
      if (section.type === 'prose' && section.content) {
        proseContent += section.content + '\n\n';
      } else if (section.type === 'mermaid') {
        let mermaidText = '```mermaid\n' + (section.definition || '') + '\n```\n';
        if (section.nodeFiles) {
          mermaidText += 'Node mappings: ';
          mermaidText += Object.entries(section.nodeFiles)
            .map(([id, info]) => `${id} → ${typeof info === 'string' ? info : info.file || ''}`)
            .join(', ');
        }
        mermaidChunks.push({
          text: mermaidText,
          metadata: { type: 'doc', route: page.route, title: page.title, section: 'mermaid' },
        });
      }
    }

    // Split prose into chunks
    if (proseContent.trim()) {
      const textChunks = chunkText(proseContent, CHUNK_SIZE);
      for (let i = 0; i < textChunks.length; i++) {
        chunks.push({
          text: `Page: ${page.title}\nRoute: ${page.route}\n${page.description ? 'Description: ' + page.description + '\n' : ''}\n${textChunks[i]}`,
          metadata: { type: 'doc', route: page.route, title: page.title, chunkIndex: i },
        });
      }
    }

    // Add mermaid chunks
    for (const mc of mermaidChunks) {
      chunks.push(mc);
    }
  }

  // Chunk source files
  for (const [filePath, info] of Object.entries(sourceFiles || {})) {
    if (!info.content) continue;
    const lines = info.content.split('\n');

    const textChunks = chunkText(info.content, CHUNK_SIZE, OVERLAP);
    let currentLine = 1;

    for (const chunkText of textChunks) {
      const chunkLines = chunkText.split('\n').length;
      chunks.push({
        text: `File: ${filePath} (${info.language})\n\n${chunkText}`,
        metadata: {
          type: 'source',
          file: filePath,
          startLine: currentLine,
          endLine: currentLine + chunkLines - 1,
          language: info.language,
        },
      });
      currentLine += chunkLines;
    }
  }

  return chunks;
}

async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'voyage-3-lite',
      input: texts,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

async function mapWithConcurrency(items, fn, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  console.log('\n  Generating embeddings for RAG mode...\n');

  const pagesData = loadJSON('pages.json');
  const sourceFiles = loadJSON('source-files.json');

  const chunks = buildChunks(pagesData, sourceFiles);
  console.log(`  ${chunks.length} chunks created`);

  // Batch embed
  const batches = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_SIZE));
  }

  console.log(`  Embedding in ${batches.length} batches (concurrency: ${CONCURRENCY})...`);

  const embeddings = [];
  await mapWithConcurrency(batches, async (batch, batchIdx) => {
    const texts = batch.map((c) => c.text);
    const vectors = await embedBatch(texts);
    for (let j = 0; j < batch.length; j++) {
      embeddings[batchIdx * BATCH_SIZE + j] = vectors[j];
    }
    process.stdout.write(`  Batch ${batchIdx + 1}/${batches.length} done\n`);
  }, CONCURRENCY);

  // Attach vectors to chunks
  const output = {
    model: 'voyage-3-lite',
    chunks: chunks.map((chunk, i) => ({
      text: chunk.text,
      metadata: chunk.metadata,
      vector: embeddings[i],
    })),
  };

  const outputPath = path.join(DATA_DIR, 'embeddings.json');
  fs.writeFileSync(outputPath, JSON.stringify(output));
  console.log(`\n  Written ${outputPath} (${chunks.length} chunks)\n`);
}

main().catch((err) => {
  console.error('\n  Embeddings generation failed:\n');
  console.error(err);
  process.exit(1);
});
