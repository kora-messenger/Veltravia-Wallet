/**
 * Veltravia AI — OpenRouter streaming client.
 *
 * Streams chat completions (SSE) from OpenRouter. Two transports:
 *  - React Native: XHR with incremental responseText (the reliable RN way)
 *  - Node/tests: fetch + ReadableStream
 * Both feed the SAME pure SSE parser, so the risky part (parsing) is fully
 * testable outside the app.
 *
 * The API key comes from build-time config (react-native-config / .env),
 * which CI injects from GitHub Actions secrets. It is never committed.
 */
import { APP_CONFIG } from '../config/env';

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  model: string;
  messages: ChatCompletionMessage[];
  maxTokens?: number;
  temperature?: number;
  onDelta: (text: string) => void;
  signal: { aborted: boolean };
}

export class OpenRouterError extends Error {
  constructor(public status: number, public code: 'RATE_LIMITED' | 'AUTH' | 'OFFLINE' | 'UNKNOWN', message: string) {
    super(message);
  }
}

/* ---- pure SSE parser (unit-testable) ----------------------------------- */

/**
 * Feeds a raw SSE byte stream and calls back with each `data:` payload.
 * Returns the number of bytes consumed so the caller can slice its buffer.
 */
export function consumeSse(buffer: string, onData: (json: string) => void): number {
  let idx = 0;
  for (;;) {
    const nl = buffer.indexOf('\n', idx);
    if (nl === -1) break;
    const line = buffer.slice(idx, nl);
    idx = nl + 1;
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      onData(payload);
    }
    // blank lines and comments are skipped implicitly
  }
  return idx;
}

/** Extracts the content delta from a chat.completion.chunk JSON payload. */
export function deltaContent(payloadJson: string): string | null {
  if (!payloadJson || payloadJson === '[DONE]') return null;
  try {
    const j = JSON.parse(payloadJson);
    const err = j?.error;
    if (err) throw new OpenRouterError(500, 'UNKNOWN', err.message ?? 'provider error');
    const d = j?.choices?.[0]?.delta?.content;
    return typeof d === 'string' ? d : null;
  } catch (e) {
    if (e instanceof OpenRouterError) throw e;
    return null; // partial JSON mid-stream is impossible per-line, but be safe
  }
}

/* ---- request body ------------------------------------------------------ */

function body(o: StreamOptions): string {
  return JSON.stringify({
    model: o.model,
    stream: true,
    max_tokens: o.maxTokens ?? 800,
    temperature: o.temperature ?? 0.4,
    messages: o.messages,
  });
}

function headers(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://veltravia.app',
    'X-Title': 'Veltravia Wallet',
  };
}

function mapStatus(status: number): OpenRouterError['code'] {
  if (status === 429) return 'RATE_LIMITED';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 0) return 'OFFLINE';
  return 'UNKNOWN';
}

/* ---- transport --------------------------------------------------------- */

export async function streamChat(o: StreamOptions, apiKey = APP_CONFIG.OPENROUTER_API_KEY): Promise<void> {
  if (!apiKey) throw new OpenRouterError(0, 'AUTH', 'No API key configured');

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const payload = body(o);
  const hdrs = headers(apiKey);

  // Transport: XHR (React Native / browsers) or fetch streaming (Node).
  if (typeof XMLHttpRequest !== 'undefined') {
    return streamViaXhr(url, hdrs, payload, o);
  }
  return streamViaFetch(url, hdrs, payload, o);
}

function xhrError(xhr: XMLHttpRequest): OpenRouterError {
  return new OpenRouterError(
    xhr.status,
    mapStatus(xhr.status),
    xhr.responseText?.slice(0, 200) || `Request failed (${xhr.status})`
  );
}

function streamViaXhr(url: string, hdrs: Record<string, string>, payload: string, o: StreamOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [k, v] of Object.entries(hdrs)) xhr.setRequestHeader(k, v);
    xhr.responseType = 'text';

    let consumed = 0;
    const pump = () => {
      const text = xhr.responseText ?? '';
      if (text.length > consumed) {
        const chunk = text.slice(consumed);
        consumed = text.length;
        let ok = true;
        consumeSse(chunk, (json) => {
          const d = deltaContent(json);
          if (d) o.onDelta(d);
          if (o.signal.aborted) ok = false;
        });
        if (!ok) {
          xhr.abort();
          resolve();
        }
      }
    };

    xhr.onreadystatechange = () => {
      if (o.signal.aborted) { xhr.abort(); return; }
      if (xhr.readyState === 3) pump(); // LOADED: partial text available
      if (xhr.readyState === 4) {
        // DONE: flush whatever remains, then report status
        try { pump(); } catch (e) { reject(e); return; }
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(xhrError(xhr));
      }
    };
    xhr.onerror = () => reject(new OpenRouterError(0, 'OFFLINE', 'Network unavailable'));
    xhr.ontimeout = () => reject(new OpenRouterError(0, 'OFFLINE', 'Request timed out'));
    xhr.timeout = 60_000;
    xhr.send(payload);
  });
}

async function streamViaFetch(url: string, hdrs: Record<string, string>, payload: string, o: StreamOptions): Promise<void> {
  // Node-only path (tests / future server). RN never reaches this branch.
  const res: any = await fetch(url, { method: 'POST', headers: hdrs, body: payload });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new OpenRouterError(res.status, mapStatus(res.status), text.slice(0, 200) || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new (globalThis as any).TextDecoder();
  let carry = '';
  for (;;) {
    if (o.signal.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const consumed = consumeSse(carry, (json) => {
      const d = deltaContent(json);
      if (d) o.onDelta(d);
    });
    carry = carry.slice(consumed);
    if (o.signal.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
  }
}
