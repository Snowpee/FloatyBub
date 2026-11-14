const { once } = require('node:events');

class VoiceGatewayError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// Forward OpenAI chat SSE, not raw HTTP chunks: reasoning-only packets and
// keepalives are not speech, and clean EOF alone does not mean a turn finished.
async function pipeVoiceCompletion(upstream, res, { signal, onContent = () => {} } = {}) {
  if (!upstream.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    throw new VoiceGatewayError('llm_not_event_stream', 'LLM did not return a chat-completion event stream');
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasContent = false;
  let finishReason = null;
  let finished = false;
  let envelope = { id: 'chatcmpl-voice', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: '' };

  const write = async packet => {
    signal?.throwIfAborted();
    if (!res.headersSent) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
    }
    if (!res.write(`data: ${typeof packet === 'string' ? packet : JSON.stringify(packet)}\n\n`)) {
      await once(res, 'drain', { signal });
    }
  };
  const complete = async () => {
    if (!hasContent) throw new VoiceGatewayError('llm_empty_reply', 'LLM returned no spoken text; use a faster model or lower reasoning effort');
    if (!finishReason) {
      await write({ ...envelope, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
    }
    await write('[DONE]');
    finished = true;
  };
  const event = async block => {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data) return;
    if (data === '[DONE]') return complete();
    let packet;
    try { packet = JSON.parse(data); }
    catch { throw new VoiceGatewayError('llm_invalid_sse', 'LLM returned malformed chat-completion data'); }
    for (const key of ['id', 'object', 'created', 'model']) {
      if (packet[key] !== undefined) envelope[key] = packet[key];
    }
    if (packet.error) throw new VoiceGatewayError('llm_stream_error', 'LLM reported an error during generation');
    const choice = packet.choices?.find(item => (item.index ?? 0) === 0);
    if (!choice) return; // usage and provider heartbeat packets
    const content = choice.delta?.content;
    if (typeof content === 'string' && content.length) {
      if (!hasContent) onContent();
      hasContent = true;
      await write({ ...packet, choices: [{ index: 0, delta: { content }, finish_reason: null }] });
    }
    if (choice.finish_reason) {
      finishReason = choice.finish_reason;
      if (hasContent) await write({ ...packet, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] });
      // finish_reason is a terminal frame. Do not wait for a provider to close
      // the socket or emit optional usage packets after the reply is complete.
      return complete();
    }
  };
  try {
    while (!finished) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Normalize CRLF only after decoding, including a CR/LF split across reads.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while (!finished && (boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        await event(block);
      }
      if (buffer.length > 1024 * 1024) throw new VoiceGatewayError('llm_invalid_sse', 'LLM event exceeds the stream limit');
      if (done) {
        if (!finished && buffer.trim()) await event(buffer);
        if (!finished) {
          if (!finishReason) throw new VoiceGatewayError('llm_stream_incomplete', 'LLM stream ended before a completion marker');
          await complete(); // Some compatible endpoints omit [DONE] after finish_reason.
        }
        break;
      }
    }
    return res.end();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

module.exports = { pipeVoiceCompletion, VoiceGatewayError };
