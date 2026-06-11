/**
 * Cloudflare Worker - Secure Gemini API Proxy
 * 
 * This Worker provides a secure proxy to Google Gemini API with:
 * - Origin validation (https://akobaloyi.github.io)
 * - Token-based authentication for development
 * - Rate limiting (60 requests per 15 minutes per IP)
 * - CORS handling
 * - Error handling with retries
 */

import { sanitizeHandle, isHandleRejected, PROFANITY_BLOCKLIST } from './leaderboard/sanitize.js';

// ===== Configuration =====
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds
const RATE_LIMIT_MAX = 60; // Max requests per window
const RETRY_DELAY = 1000; // 1 second backoff for rate-limited upstream

// Default models (can be overridden in request)
const DEFAULT_TEXT_MODEL = 'gemini-pro';
const DEFAULT_VISION_MODEL = 'gemini-pro-vision';

// ===== Main Request Handler =====
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight (covers all routes uniformly)
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    const url = new URL(request.url);

    // Preserve the existing /api/gemini-pro contract: today the worker rejects
    // any non-POST request with 405 BEFORE checking the path. Keep that guard
    // specifically for the gemini path so the leaderboard GET route can still
    // pass through the route table below.
    if (url.pathname === '/api/gemini-pro' && request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
    }

    // Route table (see design.md §Worker design — Worker design routes table)
    const route = `${request.method} ${url.pathname}`;
    switch (route) {
      case 'POST /api/gemini-pro':
        return handleGemini(request, env);
      case 'GET /leaderboard':
        return handleLeaderboardGet(request, env);
      case 'POST /leaderboard':
        return handleLeaderboardPost(request, env);
      default:
        return jsonResponse({ ok: false, error: 'Not found' }, 404);
    }
  }
};

// ===== Gemini Route Handler =====
// Extracted from the previous inline fetch() pipeline. Behavior is unchanged:
// auth -> rate-limit -> parse body -> determine model -> call Gemini -> respond.
// The try/catch lives here so future leaderboard handlers manage their own errors.
async function handleGemini(request, env) {
  try {
    // 1. Validate origin or token
    const authResult = await validateAuth(request, env);
    if (!authResult.valid) {
      return jsonResponse({ ok: false, error: authResult.error }, 403);
    }

    // 2. Rate limiting
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitResult = await checkRateLimit(clientIP, env);
    if (!rateLimitResult.allowed) {
      return jsonResponse(
        {
          ok: false,
          error: 'Rate limit exceeded. Try again later.',
          retryAfter: rateLimitResult.retryAfter
        },
        429,
        { 'Retry-After': rateLimitResult.retryAfter.toString() }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { model, prompt, type, options, systemInstruction, contents } = body;

    // 4. Determine model. The Chat Attack game/free-play client sends
    // model: 'gemini-2.0-flash'; the legacy callers omit it and fall back here.
    const modelName = model || (type === 'vision' ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL);

    // 5. Forward to Gemini API. Two accepted request shapes:
    //   (a) Chat shape  { systemInstruction, contents, generationConfig } — used
    //       by the Chat Attack frontend so the API key never ships to the client.
    //   (b) Legacy shape { prompt, options } — preserved for existing callers.
    let geminiResponse;
    if (Array.isArray(contents)) {
      geminiResponse = await callGeminiChat(
        modelName,
        { systemInstruction, contents, generationConfig: body.generationConfig },
        env.GEMINI_API_KEY
      );
    } else {
      if (!prompt) {
        return jsonResponse({ ok: false, error: 'Prompt is required' }, 400);
      }
      geminiResponse = await callGeminiAPI(
        modelName,
        prompt,
        options,
        env.GEMINI_API_KEY
      );
    }

    // 6. Return normalized response
    return jsonResponse(geminiResponse, geminiResponse.ok ? 200 : 500);

  } catch (error) {
    console.error('Worker error:', error);
    return jsonResponse(
      { ok: false, error: 'Internal server error', details: error.message },
      500
    );
  }
}

// ===== Leaderboard Route Handlers =====

/**
 * Comparator for LeaderboardEntry records (REQ-5 §10 ranking rule).
 * Ranking: levelsCleared descending, then totalAttempts ascending,
 * then totalTimeSeconds ascending. Reused by the cap/eviction logic
 * in the POST handler (tasks 39/40).
 */
function compareEntries(a, b) {
  const levelsA = a?.levelsCleared ?? 0;
  const levelsB = b?.levelsCleared ?? 0;
  if (levelsA !== levelsB) {
    return levelsB - levelsA; // higher levelsCleared first
  }

  const attemptsA = a?.totalAttempts ?? 0;
  const attemptsB = b?.totalAttempts ?? 0;
  if (attemptsA !== attemptsB) {
    return attemptsA - attemptsB; // fewer attempts first
  }

  const timeA = a?.totalTimeSeconds ?? 0;
  const timeB = b?.totalTimeSeconds ?? 0;
  return timeA - timeB; // less time first
}

/**
 * GET /leaderboard — returns a JSON array of the top up-to-20 entries
 * (REQ-5 §§1, 10). Auth is enforced via validateAuth; on failure responds
 * 403 { ok:false, error:'forbidden' }. Any KV failure responds
 * 500 { ok:false, error:'kv_error' }.
 */
async function handleLeaderboardGet(request, env) {
  const authResult = await validateAuth(request, env);
  if (!authResult.valid) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }

  try {
    const list = await env.LEADERBOARD.list({ prefix: 'entry:', limit: 1000 });
    const fetched = await Promise.all(
      list.keys.map(k => env.LEADERBOARD.get(k.name, 'json'))
    );
    const entries = fetched.filter(
      entry => entry !== null && typeof entry === 'object'
    );
    const top = entries.sort(compareEntries).slice(0, 20);
    return jsonResponse(top, 200);
  } catch (error) {
    console.error('Leaderboard GET KV error:', error);
    return jsonResponse({ ok: false, error: 'kv_error' }, 500);
  }
}

// ===== Leaderboard rate-limit configuration (REQ-5 §§8, 9) =====
// Distinct from the gemini RATE_LIMIT_* constants above: a 24h window allowing
// at most 5 successful submissions per IP, keyed by `submit:<ip>` in LEADERBOARD KV.
const LEADERBOARD_RL_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const LEADERBOARD_RL_MAX = 5; // Max successful submissions per window
const LEADERBOARD_MAX_ENTRIES = 200; // Cap on stored entries (REQ-5 §14)

/**
 * Resolve the client IP for leaderboard rate-limiting (REQ-5 §8).
 * Falls back to 'unknown' when CF-Connecting-IP is absent.
 */
function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/**
 * Read the current `submit:<ip>` rate-limit state and decide whether another
 * successful submission is allowed (REQ-5 §§8, 9). This does NOT mutate state —
 * the counter is only incremented on a successful submission via
 * {@link recordLeaderboardSubmission}.
 *
 * @returns {Promise<{ allowed: boolean, retryAfter: number, windowStart: number, count: number }>}
 *   `retryAfter` is the remaining seconds in the current window clamped to [1, 86400]
 *   and is only meaningful when `allowed` is false.
 */
async function checkLeaderboardRateLimit(ip, env) {
  const now = Date.now();
  const key = `submit:${ip}`;
  const data = await env.LEADERBOARD.get(key, 'json');

  if (data && typeof data.windowStart === 'number') {
    const windowAge = now - data.windowStart;
    if (windowAge <= LEADERBOARD_RL_WINDOW) {
      // Active window: enforce the limit.
      if ((data.count ?? 0) >= LEADERBOARD_RL_MAX) {
        const remaining = Math.ceil((LEADERBOARD_RL_WINDOW - windowAge) / 1000);
        const retryAfter = Math.min(86400, Math.max(1, remaining));
        return { allowed: false, retryAfter, windowStart: data.windowStart, count: data.count };
      }
      return { allowed: true, retryAfter: 0, windowStart: data.windowStart, count: data.count ?? 0 };
    }
  }

  // No state or expired window: a fresh window will start on success.
  return { allowed: true, retryAfter: 0, windowStart: now, count: 0 };
}

/**
 * Record a successful submission against the IP's rate-limit window (REQ-5 §8).
 * Called ONLY after a successful persist. If the existing window is still valid
 * its count is incremented; otherwise a fresh window is started at `now`.
 *
 * @param {{ allowed: boolean, windowStart: number, count: number }} state
 *   The state previously returned by {@link checkLeaderboardRateLimit}.
 */
async function recordLeaderboardSubmission(ip, env, state) {
  const now = Date.now();
  const key = `submit:${ip}`;

  const windowValid =
    typeof state?.windowStart === 'number' && now - state.windowStart <= LEADERBOARD_RL_WINDOW;

  const next = windowValid
    ? { count: (state.count ?? 0) + 1, windowStart: state.windowStart }
    : { count: 1, windowStart: now };

  await env.LEADERBOARD.put(key, JSON.stringify(next), {
    expirationTtl: Math.ceil(LEADERBOARD_RL_WINDOW / 1000),
  });
}

/**
 * POST /leaderboard — validation pipeline (REQ-5 §§2-14).
 *
 * Each condition is evaluated independently (no summary flag — REQ-5 §11) and
 * the pipeline short-circuits on the first failure. Order:
 *   1. Auth (REQ-5 §10)        -> 403 forbidden
 *   2. Parse body (REQ-5 §12)  -> 400 invalid_json
 *   3. Field validation (§§3,4)-> 400 levels_cleared_invalid / attempts_out_of_range / time_out_of_range
 *   4. Handle sanitize/length  -> 400 handle_invalid (REQ-5 §§5, 6)
 *   5. Profanity (REQ-5 §7)    -> 422 handle_rejected
 *   6. Rate limit (§§8, 9)     -> 429 rate_limited (+ Retry-After)
 *   7. Success (§§11, 13, 14)  -> 201 { ok:true, entry }
 */
async function handleLeaderboardPost(request, env) {
  // 1. AUTH FIRST (REQ-5 §10) — origin/token gate runs before parsing.
  const authResult = await validateAuth(request, env);
  if (!authResult.valid) {
    return jsonResponse({ ok: false, error: 'forbidden' }, 403);
  }

  // 2. PARSE BODY (REQ-5 §12) — malformed/empty JSON is invalid_json.
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (body === null || typeof body !== 'object') {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  // 3. FIELD VALIDATIONS (REQ-5 §§3, 4) — each independent, first failure wins.
  if (body.levelsCleared !== 7) {
    return jsonResponse({ ok: false, error: 'levels_cleared_invalid' }, 400);
  }
  const { totalAttempts, totalTimeSeconds } = body;
  if (!Number.isInteger(totalAttempts) || totalAttempts < 1 || totalAttempts > 10000) {
    return jsonResponse({ ok: false, error: 'attempts_out_of_range' }, 400);
  }
  if (!Number.isInteger(totalTimeSeconds) || totalTimeSeconds < 0 || totalTimeSeconds > 86400) {
    return jsonResponse({ ok: false, error: 'time_out_of_range' }, 400);
  }

  // 4. HANDLE SANITIZE + LENGTH (REQ-5 §§5, 6).
  const handle = sanitizeHandle(body.handle);
  if (handle.length < 3 || handle.length > 16) {
    return jsonResponse({ ok: false, error: 'handle_invalid' }, 400);
  }

  // 5. PROFANITY (REQ-5 §7).
  if (isHandleRejected(handle)) {
    return jsonResponse({ ok: false, error: 'handle_rejected' }, 422);
  }

  // 6. RATE LIMIT (REQ-5 §§8, 9) — read-only check; counter bumped on success.
  const ip = getClientIp(request);
  let rlState;
  try {
    rlState = await checkLeaderboardRateLimit(ip, env);
  } catch (error) {
    console.error('Leaderboard POST rate-limit KV error:', error);
    return jsonResponse({ ok: false, error: 'kv_error' }, 500);
  }
  if (!rlState.allowed) {
    return jsonResponse(
      { ok: false, error: 'rate_limited' },
      429,
      { 'Retry-After': rlState.retryAfter.toString() }
    );
  }

  // 7. SUCCESS (REQ-5 §§11, 13, 14).
  // Store the SANITIZED handle so the §13 invariant /^[a-z0-9_-]{3,16}$/ holds.
  const entry = {
    handle,
    levelsCleared: 7,
    totalAttempts,
    totalTimeSeconds,
    submittedAt: new Date().toISOString(),
  };

  try {
    // Persist first so the insert succeeds even if later steps fail.
    await env.LEADERBOARD.put('entry:' + crypto.randomUUID(), JSON.stringify(entry));
  } catch (error) {
    console.error('Leaderboard POST persist KV error:', error);
    return jsonResponse({ ok: false, error: 'kv_error' }, 500);
  }

  // Increment the IP rate-limit counter ONLY on success (REQ-5 §8).
  try {
    await recordLeaderboardSubmission(ip, env, rlState);
  } catch (error) {
    console.error('Leaderboard POST rate-limit update error:', error);
    // Non-fatal: the entry is already stored.
  }

  // Enforce the 200-entry cap by listing-and-evicting (REQ-5 §14).
  // Runs AFTER the insert and is wrapped so eviction failure cannot fail the request.
  try {
    const list = await env.LEADERBOARD.list({ prefix: 'entry:', limit: 1000 });
    if (list.keys.length > LEADERBOARD_MAX_ENTRIES) {
      const records = await Promise.all(
        list.keys.map(async (k) => ({
          name: k.name,
          value: await env.LEADERBOARD.get(k.name, 'json'),
        }))
      );
      const valid = records.filter(
        (r) => r.value !== null && typeof r.value === 'object'
      );
      valid.sort((a, b) => compareEntries(a.value, b.value));
      const evict = valid.slice(LEADERBOARD_MAX_ENTRIES);
      await Promise.all(evict.map((r) => env.LEADERBOARD.delete(r.name)));
    }
  } catch (error) {
    console.error('Leaderboard POST eviction error:', error);
    // Non-fatal: the entry is already stored.
  }

  return jsonResponse({ ok: true, entry }, 201);
}

// ===== Authentication =====
async function validateAuth(request, env) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const token = request.headers.get('x-sandbox-token');
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://akobaloyi.github.io';

  // Check 1: Valid origin
  if (origin === allowedOrigin || (referer && referer.startsWith(allowedOrigin))) {
    return { valid: true };
  }

  // Check 2: Valid dev token
  if (token && env.SANDBOX_DEV_TOKEN && token === env.SANDBOX_DEV_TOKEN) {
    return { valid: true };
  }

  return { 
    valid: false, 
    error: 'Unauthorized: Invalid origin or token' 
  };
}

// ===== Rate Limiting =====
async function checkRateLimit(clientIP, env) {
  const now = Date.now();
  const key = `ratelimit:${clientIP}`;

  // Try KV-based rate limiting if available
  if (env.RATE_LIMIT) {
    try {
      const data = await env.RATE_LIMIT.get(key, 'json');
      
      if (data) {
        const { count, windowStart } = data;
        const windowAge = now - windowStart;

        // Window expired, reset
        if (windowAge > RATE_LIMIT_WINDOW) {
          await env.RATE_LIMIT.put(key, JSON.stringify({
            count: 1,
            windowStart: now
          }), { expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000) });
          return { allowed: true };
        }

        // Within window, check limit
        if (count >= RATE_LIMIT_MAX) {
          const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - windowAge) / 1000);
          return { allowed: false, retryAfter };
        }

        // Increment count
        await env.RATE_LIMIT.put(key, JSON.stringify({
          count: count + 1,
          windowStart
        }), { expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000) });
        return { allowed: true };
      }

      // First request in window
      await env.RATE_LIMIT.put(key, JSON.stringify({
        count: 1,
        windowStart: now
      }), { expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000) });
      return { allowed: true };

    } catch (error) {
      console.error('KV rate limit error:', error);
      // Fall through to in-memory fallback
    }
  }

  // Fallback: In-memory rate limiting (stateless, per-request)
  // Note: This is less effective but works without KV
  // For production, always use KV namespace
  console.warn('Using stateless rate limiting - KV recommended for production');
  return { allowed: true }; // Allow by default in stateless mode
}

// ===== Gemini Chat Integration (Chat Attack frontend) =====
// Accepts the pre-built chat payload from the browser (systemInstruction +
// contents) and forwards it to Gemini using the server-held API key, so the
// key never ships to the client. Returns the same normalized shape as
// callGeminiAPI: { ok, text, raw } or { ok:false, error, ... }.
async function callGeminiChat(model, { systemInstruction, contents, generationConfig }, apiKey) {
  if (!apiKey) {
    return { ok: false, error: 'API key not configured' };
  }

  const payload = { contents };
  if (systemInstruction !== undefined) {
    // Accept either the Gemini object form { parts:[{text}] } or a raw string.
    payload.systemInstruction =
      typeof systemInstruction === 'string'
        ? { parts: [{ text: systemInstruction }] }
        : systemInstruction;
  }
  payload.generationConfig = generationConfig || {
    temperature: 0.7,
    maxOutputTokens: 500,
  };

  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 429) {
        if (attempt === 0) {
          await sleep(RETRY_DELAY);
          continue;
        }
        return { ok: false, error: 'Upstream rate limit exceeded', status: 429 };
      }

      if (!response.ok) {
        return {
          ok: false,
          error: data.error?.message || 'Gemini API error',
          status: response.status,
          raw: data,
        };
      }

      return { ok: true, text: extractTextFromResponse(data), raw: data };
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(RETRY_DELAY);
        continue;
      }
    }
  }

  return { ok: false, error: 'Failed to call Gemini API', details: lastError?.message };
}

// ===== Gemini API Integration =====
async function callGeminiAPI(model, prompt, options = {}, apiKey) {
  if (!apiKey) {
    return { ok: false, error: 'API key not configured' };
  }

  // Build request payload
  const payload = buildGeminiPayload(prompt, options);
  
  // Construct URL
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

  // Make request with retry logic
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      // Handle rate limiting from upstream
      if (response.status === 429) {
        if (attempt === 0) {
          await sleep(RETRY_DELAY);
          continue; // Retry once
        }
        return { 
          ok: false, 
          error: 'Upstream rate limit exceeded',
          status: 429 
        };
      }

      // Handle other errors
      if (!response.ok) {
        return {
          ok: false,
          error: data.error?.message || 'Gemini API error',
          status: response.status,
          raw: data
        };
      }

      // Success - extract text
      const text = extractTextFromResponse(data);
      return {
        ok: true,
        text,
        raw: data
      };

    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await sleep(RETRY_DELAY);
        continue; // Retry once
      }
    }
  }

  return {
    ok: false,
    error: 'Failed to call Gemini API',
    details: lastError?.message
  };
}

// ===== Payload Builder =====
function buildGeminiPayload(prompt, options = {}) {
  const payload = {
    contents: []
  };

  // Handle different prompt formats
  if (typeof prompt === 'string') {
    // Simple text prompt
    payload.contents.push({
      parts: [{ text: prompt }]
    });
  } else if (Array.isArray(prompt)) {
    // Array of parts (for vision with images)
    payload.contents.push({
      parts: prompt
    });
  } else if (prompt.parts) {
    // Already formatted
    payload.contents.push(prompt);
  }

  // Add generation config if provided
  if (options.temperature !== undefined || 
      options.maxOutputTokens !== undefined ||
      options.topP !== undefined ||
      options.topK !== undefined) {
    payload.generationConfig = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 500,
      topP: options.topP,
      topK: options.topK
    };
  }

  return payload;
}

// ===== Response Parser =====
function extractTextFromResponse(data) {
  try {
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts) {
        return candidate.content.parts
          .map(part => part.text)
          .filter(Boolean)
          .join('');
      }
    }
    return '';
  } catch (error) {
    console.error('Error extracting text:', error);
    return '';
  }
}

// ===== CORS Handler =====
function handleCORS(request, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://akobaloyi.github.io';
  const origin = request.headers.get('Origin');

  const headers = {
    'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sandbox-token',
    'Access-Control-Max-Age': '86400',
  };

  return new Response(null, { status: 204, headers });
}

// ===== Response Helper =====
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://akobaloyi.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sandbox-token',
    ...additionalHeaders
  };

  return new Response(JSON.stringify(data), { status, headers });
}

// ===== Utility =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
