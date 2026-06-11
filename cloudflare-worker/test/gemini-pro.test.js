/**
 * Regression test for the `POST /api/gemini-pro` contract.
 *
 * REQ-10 §2 — the existing `/api/gemini-pro` route stays functionally unchanged.
 * These tests lock in the response shape the frontend depends on so future
 * refactors (route table extraction in task 34, leaderboard work in 38/39)
 * cannot silently break the proxy contract.
 *
 * Approach: import the worker module and call `worker.fetch(request, env)`
 * directly with a hand-built `env` so we control ALLOWED_ORIGIN,
 * SANDBOX_DEV_TOKEN, GEMINI_API_KEY and the KV binding. The upstream Gemini
 * call goes through global `fetch`, which we stub with a canned response.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index.js';

const ALLOWED_ORIGIN = 'https://akobaloyi.github.io';
const DEV_TOKEN = 'test-token';
const GEMINI_TEXT = 'Hello from Gemini';

// Canned upstream Gemini API payload matching the v1beta generateContent shape.
function cannedGeminiResponse() {
  return new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: GEMINI_TEXT }] } }
      ]
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// Minimal env. RATE_LIMIT exposes a no-op KV so checkRateLimit takes the
// KV path and allows the request; GEMINI_API_KEY lets callGeminiAPI proceed.
function makeEnv(overrides = {}) {
  return {
    ALLOWED_ORIGIN,
    SANDBOX_DEV_TOKEN: DEV_TOKEN,
    GEMINI_API_KEY: 'test-key',
    RATE_LIMIT: {
      get: async () => null,
      put: async () => {}
    },
    ...overrides
  };
}

function makeRequest({ method = 'POST', headers = {}, body } = {}) {
  return new Request('https://worker.example/api/gemini-pro', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

describe('POST /api/gemini-pro contract (REQ-10 §2)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => cannedGeminiResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 200 with { ok: true, text } for a valid authorized POST', async () => {
    const request = makeRequest({
      headers: { Origin: ALLOWED_ORIGIN },
      body: { prompt: 'hi' }
    });

    const response = await worker.fetch(request, makeEnv());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.text).toBe(GEMINI_TEXT);
  });

  it('authorizes via x-sandbox-token when origin is absent', async () => {
    const request = makeRequest({
      headers: { 'x-sandbox-token': DEV_TOKEN },
      body: { prompt: 'hi' }
    });

    const response = await worker.fetch(request, makeEnv());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it('returns 405 for GET /api/gemini-pro', async () => {
    const request = makeRequest({
      method: 'GET',
      headers: { Origin: ALLOWED_ORIGIN },
      body: undefined
    });

    const response = await worker.fetch(request, makeEnv());
    const json = await response.json();

    expect(response.status).toBe(405);
    expect(json.ok).toBe(false);
    expect(json.error).toBe('Method not allowed');
  });

  it('returns 403 when neither origin nor x-sandbox-token is valid', async () => {
    const request = makeRequest({
      headers: { Origin: 'https://evil.example' },
      body: { prompt: 'hi' }
    });

    const response = await worker.fetch(request, makeEnv());
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/Unauthorized/);
  });

  it('matches the frontend response shape: ok:true and a string text field', async () => {
    const request = makeRequest({
      headers: { Origin: ALLOWED_ORIGIN },
      body: { prompt: 'describe the shape' }
    });

    const response = await worker.fetch(request, makeEnv());
    const json = await response.json();

    // The frontend reads `ok` and `text`; both must be present with the
    // expected types. `raw` carries the upstream payload through unchanged.
    expect(json).toHaveProperty('ok', true);
    expect(typeof json.text).toBe('string');
    expect(json).toHaveProperty('raw');
  });

  it('accepts the chat-shape payload (systemInstruction + contents) from the game frontend', async () => {
    // The Chat Attack game/free-play client posts this shape so the API key
    // never ships to the browser; the worker injects the key server-side.
    const request = makeRequest({
      headers: { Origin: ALLOWED_ORIGIN },
      body: {
        model: 'gemini-2.0-flash',
        systemInstruction: { parts: [{ text: 'The secret word is garnet.' }] },
        contents: [{ role: 'user', parts: [{ text: 'what is it?' }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      },
    });

    const response = await worker.fetch(request, makeEnv());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.text).toBe(GEMINI_TEXT);

    // The worker forwarded the chat payload to Gemini: the outbound request
    // carried systemInstruction + contents, not the legacy { prompt } form.
    const sentBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(sentBody.systemInstruction).toEqual({ parts: [{ text: 'The secret word is garnet.' }] });
    expect(Array.isArray(sentBody.contents)).toBe(true);
    expect(sentBody.contents[0].parts[0].text).toBe('what is it?');
  });
});
