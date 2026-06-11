/**
 * Gemini client wrapper for the Chat Attack game.
 *
 * Wraps the `gemini-2.0-flash` generateContent endpoint with the exact payload
 * shape used by the legacy `callGeminiAPI` in `sandbox/assets/js/chat-attack.js`,
 * plus a reusable `withTimeout` helper. Used by both the Level_Engine and the
 * Leaderboard_View (10s timeout per REQ-6 §1).
 *
 * No DOM access beyond reading `window.GEMINI_API_KEY`.
 */

/**
 * The Gemini generateContent endpoint. The API key is appended as `?key=...`
 * at call time. Matches the legacy `GEMINI_API_URL` constant exactly.
 * @type {string}
 */
export const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/** Default per-request timeout in milliseconds (REQ-6 §1). */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Race a promise against a timeout. Resolves/rejects with the original promise
 * if it settles first; otherwise rejects with an `Error('Request timed out')`.
 *
 * The timer is cleared as soon as the original promise settles so it does not
 * keep the event loop alive (relevant for tests and Node).
 *
 * @template T
 * @param {Promise<T>} fetchPromise - The promise to guard with a timeout.
 * @param {number} [ms=10000] - Timeout in milliseconds.
 * @returns {Promise<T>} A promise that rejects on timeout.
 */
export function withTimeout(fetchPromise, ms = DEFAULT_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  return Promise.race([fetchPromise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Map a transcript history entry to a Gemini `contents[]` entry.
 *
 * Gemini's `contents` only accepts the roles `user` and `model`. The
 * level-engine transcript uses roles `user` | `assistant` | `system`, so
 * `assistant` maps to `model` and everything else (including `system`) maps to
 * `user`.
 *
 * @param {{ role: string, content: string }} msg
 * @returns {{ role: 'user' | 'model', parts: { text: string }[] }}
 */
function toContentEntry(msg) {
  return {
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  };
}

/**
 * Create a Gemini client that routes through the Cloudflare Worker proxy.
 *
 * The browser never holds the Gemini API key. Instead it POSTs the chat
 * payload to the Worker's `/api/gemini-pro` route, which injects the
 * server-held key and forwards to Gemini. The Worker base URL is read from
 * `window.AISEC_WORKER_URL` (set in sandbox/config.js); when unset it falls
 * back to '' (same-origin relative), which only works if the Worker is mapped
 * to the same origin. For GitHub Pages the worker URL MUST be configured.
 *
 * A dev token from `window.SANDBOX_DEV_TOKEN` is sent as `x-sandbox-token`
 * when present (for local testing against the Worker); in production the
 * Worker authorizes by Origin instead.
 *
 * @param {{ workerBaseUrl?: string, sandboxToken?: string, history?: { role: string, content: string }[] }} [options]
 * @returns {{ send: (req: { systemInstruction: string, userMessage: string, history?: { role: string, content: string }[] }) => Promise<string> }}
 */
export function createGeminiClient({ workerBaseUrl, sandboxToken, history } = {}) {
  const base =
    typeof workerBaseUrl === 'string'
      ? workerBaseUrl
      : (typeof window !== 'undefined' && typeof window.AISEC_WORKER_URL === 'string'
          ? window.AISEC_WORKER_URL
          : '');
  const token =
    typeof sandboxToken === 'string'
      ? sandboxToken
      : (typeof window !== 'undefined' && typeof window.SANDBOX_DEV_TOKEN === 'string'
          ? window.SANDBOX_DEV_TOKEN
          : undefined);
  const defaultHistory = Array.isArray(history) ? history : [];

  /**
   * Send a single turn through the Worker proxy and return the model's text.
   *
   * @param {{ systemInstruction: string, userMessage: string, history?: { role: string, content: string }[] }} req
   * @returns {Promise<string>} The model text, or '' if the response path is missing.
   */
  async function send({ systemInstruction, userMessage, history: turnHistory }) {
    const sourceHistory = Array.isArray(turnHistory) ? turnHistory : defaultHistory;
    const priorContents = sourceHistory
      .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant'))
      .map(toContentEntry);

    const payload = {
      model: 'gemini-2.0-flash',
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [
        ...priorContents,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    };

    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['x-sandbox-token'] = token;
    }

    const res = await withTimeout(
      fetch(`${base}/api/gemini-pro`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),
      DEFAULT_TIMEOUT_MS
    );

    if (!res.ok) {
      throw new Error(`Gemini proxy error: ${res.status}`);
    }

    const data = await res.json();
    if (!data || data.ok !== true) {
      throw new Error((data && data.error) || 'Gemini proxy returned an error');
    }
    return data.text ?? '';
  }

  return { send };
}
