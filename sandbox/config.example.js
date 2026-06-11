// Frontend configuration for the AI Security Sandbox.
//
// The Gemini API key is NEVER stored here or anywhere that ships to the
// browser. It lives only as a Cloudflare Worker secret. The frontend talks to
// the Worker, which injects the key server-side.
//
// Setup:
// 1. Copy this file to config.js (config.js is gitignored).
// 2. Set AISEC_WORKER_URL to your deployed Worker origin (no trailing slash),
//    e.g. https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev
// 3. (Optional, local dev only) set SANDBOX_DEV_TOKEN to the value you set via
//    `wrangler secret put SANDBOX_DEV_TOKEN`, so requests from localhost pass
//    the Worker's auth check. In production the Worker authorizes by Origin,
//    so the token is not needed on the deployed site.

window.AISEC_WORKER_URL = 'https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev';

// Optional, for local development against the Worker:
// window.SANDBOX_DEV_TOKEN = 'your-dev-token-here';
