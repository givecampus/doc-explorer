/**
 * Client helper for the /api/chat endpoint.
 * Returns an async generator that yields text chunks from the SSE stream.
 */

export async function* sendMessage(messages, currentRoute, signal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, currentRoute }),
    signal,
  });

  if (!res.ok) {
    let errorMsg = `Chat request failed (${res.status})`;
    try {
      const err = await res.json();
      if (err.error) errorMsg = err.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();

      try {
        const event = JSON.parse(data);
        if (event.type === 'delta' && event.text) {
          yield event.text;
        } else if (event.type === 'done') {
          return;
        }
      } catch {
        // Skip unparseable
      }
    }
  }
}
