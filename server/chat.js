/**
 * Vite plugin + standalone middleware for the AI chat endpoint.
 *
 * - POST /api/chat  — proxies to Anthropic Messages API with streaming
 * - Auto-detects full-context vs RAG mode based on embeddings.json
 * - Reads ANTHROPIC_API_KEY from .env (inline parser, no deps)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// --------------- .env loader (same pattern as build/lib/env.js) ---------------

function loadEnv() {
  const envPath = path.resolve(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
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

loadEnv();

// --------------- Data loading ---------------

const DATA_DIR = path.resolve(PROJECT_ROOT, 'app', 'src', 'data');

function loadJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

let pagesData = null;
let sourceFiles = null;
let embeddingsData = null;

function ensureDataLoaded() {
  if (!pagesData) pagesData = loadJSON('pages.json');
  if (!sourceFiles) sourceFiles = loadJSON('source-files.json');
  if (!embeddingsData) embeddingsData = loadJSON('embeddings.json');
}

// --------------- Context builders ---------------

function buildFullContextPrompt(pages, sourceFiles, currentRoute) {
  const parts = [];

  parts.push('You are a helpful assistant that answers questions about a documented codebase.');
  parts.push('Below is the complete documentation and source code available.\n');

  // Citation instructions
  parts.push('When citing documentation pages, use markdown links like: [Page Title](/route)');
  parts.push('When citing source files, use: [filepath:lines](source://filepath:lines)');
  parts.push('Only cite pages and files that exist in the context provided below.\n');

  // Find the current page to prioritize its source files
  const currentPage = pages ? Object.values(pages).find((p) => p.route === currentRoute) : null;
  const currentSourceFiles = new Set();
  if (currentPage) {
    for (const section of currentPage.sections || []) {
      if (section.type === 'mermaid' && section.nodeFiles) {
        for (const nf of Object.values(section.nodeFiles)) {
          if (nf.file) currentSourceFiles.add(nf.file.replace(/:.*$/, ''));
        }
      }
    }
  }

  // Documentation pages
  if (pages) {
    parts.push('=== DOCUMENTATION PAGES ===\n');
    for (const page of Object.values(pages)) {
      parts.push(`--- Page: ${page.title || '(untitled)'} ---`);
      parts.push(`Route: ${page.route}`);
      if (page.description) parts.push(`Description: ${page.description}`);
      if (page.tags?.length) parts.push(`Tags: ${page.tags.join(', ')}`);
      parts.push('');

      for (const section of page.sections || []) {
        if (section.type === 'prose' && section.content) {
          parts.push(section.content);
        } else if (section.type === 'mermaid') {
          parts.push('```mermaid');
          parts.push(section.definition || '');
          parts.push('```');
          if (section.nodeFiles) {
            parts.push('Node-to-file mappings:');
            for (const [nodeId, info] of Object.entries(section.nodeFiles)) {
              parts.push(`  ${nodeId} → ${typeof info === 'string' ? info : info.file || ''}`);
            }
          }
        }
      }
      parts.push('');
    }
  }

  // Source files — include files referenced by current page in full,
  // and just metadata for the rest to stay within context limits
  if (sourceFiles) {
    parts.push('=== SOURCE FILES ===\n');
    for (const [filePath, info] of Object.entries(sourceFiles)) {
      const isCurrentRef = currentSourceFiles.has(filePath);
      parts.push(`--- File: ${filePath} (${info.language}, ${info.totalLines} lines) ---`);
      if (isCurrentRef && info.content) {
        parts.push(info.content);
      } else if (info.content) {
        // Include a truncated version for non-current files
        const lines = info.content.split('\n');
        if (lines.length > 50) {
          parts.push(lines.slice(0, 50).join('\n'));
          parts.push(`... (${lines.length - 50} more lines)`);
        } else {
          parts.push(info.content);
        }
      }
      parts.push('');
    }
  }

  return parts.join('\n');
}

function buildRAGContextPrompt(embeddingsData, queryEmbedding, currentRoute) {
  // Compute cosine similarity and pick top chunks
  const scored = embeddingsData.chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.vector),
  }));

  // Boost chunks from the current route
  for (const chunk of scored) {
    if (chunk.metadata?.route === currentRoute) {
      chunk.score += 0.1;
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored.slice(0, 18);

  const parts = [];
  parts.push('You are a helpful assistant that answers questions about a documented codebase.');
  parts.push('Below are the most relevant excerpts from the documentation and source code.\n');
  parts.push('When citing documentation pages, use markdown links like: [Page Title](/route)');
  parts.push('When citing source files, use: [filepath:lines](source://filepath:lines)');
  parts.push('Only cite pages and files that exist in the context provided below.\n');

  for (const chunk of topChunks) {
    const meta = chunk.metadata;
    if (meta.type === 'doc') {
      parts.push(`--- Doc: ${meta.title || ''} (${meta.route}) ---`);
    } else if (meta.type === 'source') {
      parts.push(`--- Source: ${meta.file} (lines ${meta.startLine}-${meta.endLine}, ${meta.language}) ---`);
    }
    parts.push(chunk.text);
    parts.push('');
  }

  return parts.join('\n');
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedQuery(text) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'voyage-3-lite',
      input: [text],
    }),
  });

  if (!res.ok) {
    console.error(`Voyage AI embedding failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.data?.[0]?.embedding || null;
}

// --------------- Request handler ---------------

async function handleChatRequest(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }));
    return;
  }

  // Parse body
  let body;
  if (typeof req.body === 'object' && req.body !== null) {
    body = req.body;
  } else {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  }

  const { messages, currentRoute } = body;
  if (!messages || !Array.isArray(messages)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'messages array required' }));
    return;
  }

  ensureDataLoaded();

  // Build system prompt
  let systemPrompt;
  const useRAG = embeddingsData && embeddingsData.chunks?.length > 0;

  if (useRAG) {
    // Embed the latest user message for retrieval
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const queryEmbedding = lastUserMsg ? await embedQuery(lastUserMsg.content) : null;

    if (queryEmbedding) {
      systemPrompt = buildRAGContextPrompt(embeddingsData, queryEmbedding, currentRoute || '/');
    } else {
      // Fallback to full context if embedding fails
      systemPrompt = buildFullContextPrompt(pagesData?.pages, sourceFiles, currentRoute || '/');
    }
  } else {
    systemPrompt = buildFullContextPrompt(pagesData?.pages, sourceFiles, currentRoute || '/');
  }

  // Call Anthropic Messages API with streaming
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    console.error(`Anthropic API error: ${anthropicRes.status}`, errText);
    res.writeHead(anthropicRes.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Anthropic API error: ${anthropicRes.status}` }));
    return;
  }

  // Stream SSE back to client
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const reader = anthropicRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            res.write(`data: ${JSON.stringify({ type: 'delta', text: event.delta.text })}\n\n`);
          }
        } catch {
          // Skip unparseable events
        }
      }
    }
  } catch (err) {
    console.error('Stream error:', err.message);
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
}

// --------------- Middleware wiring shared by dev + preview ---------------

function wireMiddleware(httpServer) {
  // httpServer is a connect-compatible middleware stack
  httpServer.use('/api/chat', async (req, res, next) => {
    if (req.method !== 'POST') return next();
    try {
      await handleChatRequest(req, res);
    } catch (err) {
      console.error('Chat handler error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });
}

// --------------- Vite plugin ---------------

export function chatPlugin() {
  return {
    name: 'doc-viewer-chat',

    // Dev server (npm run dev)
    configureServer(server) {
      ensureDataLoaded();
      console.log(`  Chat plugin loaded (${embeddingsData ? 'RAG' : 'full-context'} mode)`);
      wireMiddleware(server.middlewares);
    },

    // Preview server (npm run preview / illumina view)
    configurePreviewServer(server) {
      ensureDataLoaded();
      console.log(`  Chat plugin loaded (${embeddingsData ? 'RAG' : 'full-context'} mode)`);
      wireMiddleware(server.middlewares);
    },
  };
}
