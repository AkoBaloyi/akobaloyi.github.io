# Quick Deploy - 5 Minutes

## Prerequisites
- Cloudflare account (free)
- Gemini API key
- Node.js installed

## Deploy in 5 Steps

### 1. Install & Login (1 min)
```bash
npm install -g wrangler
wrangler login
```

### 2. Create KV Namespace (1 min)
```bash
cd cloudflare-worker
wrangler kv:namespace create "RATE_LIMIT"
```

Copy the `id` and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "paste_id_here"
```

### 3. Set Secrets (1 min)
```bash
wrangler secret put GEMINI_API_KEY
# Paste: AIzaSy...

wrangler secret put SANDBOX_DEV_TOKEN
# Paste: any_secure_random_string
```

### 4. Deploy (1 min)
```bash
wrangler deploy
```

### 5. Test (1 min)
```bash
curl -X POST https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev/api/gemini-pro \
  -H "Content-Type: application/json" \
  -H "x-sandbox-token: YOUR_DEV_TOKEN" \
  -d '{"prompt": "Say hello"}'
```

## Update Frontend

Replace in `chat-attack.js` and `image-attack.js`:

```javascript
// OLD
const GEMINI_API_KEY = window.GEMINI_API_KEY || '';

// NEW
const WORKER_URL = 'https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev';
```

See `examples/frontend-integration.js` for complete code.

## Done! 🎉

Your API key is now secure on Cloudflare's edge network.

**Cost**: FREE for up to 100,000 requests/day

---

**Need help?** See README.md or DEPLOYMENT_GUIDE.md
