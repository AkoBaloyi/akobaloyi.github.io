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
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(request, env);
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
    }

    // Check route
    const url = new URL(request.url);
    if (url.pathname !== '/api/gemini-pro') {
      return jsonResponse({ ok: false, error: 'Not found' }, 404);
    }

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
      const { model, prompt, type, options } = body;

      if (!prompt) {
        return jsonResponse({ ok: false, error: 'Prompt is required' }, 400);
      }

      // 4. Determine model
      const modelName = model || (type === 'vision' ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL);

      // 5. Forward to Gemini API
      const geminiResponse = await callGeminiAPI(
        modelName,
        prompt,
        options,
        env.GEMINI_API_KEY
      );

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
};

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
