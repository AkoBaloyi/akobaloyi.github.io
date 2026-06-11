# Cloudflare Worker Deployment Guide

## Step-by-Step Deployment

### Prerequisites

- Cloudflare account (free tier works)
- Node.js 16+ installed
- Gemini API key from Google

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
# or use npx
npx wrangler --version
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This opens a browser window to authenticate.

### Step 3: Create KV Namespace (Recommended)

```bash
cd cloudflare-worker
wrangler kv:namespace create "RATE_LIMIT"
```

**Output example:**
```
🌀 Creating namespace with title "gemini-proxy-worker-RATE_LIMIT"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "RATE_LIMIT", id = "abc123def456" }
```

**Update `wrangler.toml`:**
```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "abc123def456"  # Use your actual ID
```

### Step 4: Set Secrets

```bash
# Set Gemini API key
wrangler secret put GEMINI_API_KEY
# Paste your key when prompted: AIzaSy...

# Set development token (generate a secure random string)
wrangler secret put SANDBOX_DEV_TOKEN
# Example: openssl rand -hex 32
```

### Step 5: Deploy

```bash
npm run deploy
# or
wrangler deploy
```

**Output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded gemini-proxy-worker (X.XX sec)
Published gemini-proxy-worker (X.XX sec)
  https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev
```

### Step 6: Test Deployment

```bash
curl -X POST https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev/api/gemini-pro \
  -H "Content-Type: application/json" \
  -H "x-sandbox-token: YOUR_DEV_TOKEN" \
  -d '{
    "model": "gemini-pro",
    "prompt": "Say hello in one sentence",
    "options": {
      "temperature": 0.7,
      "maxOutputTokens": 50
    }
  }'
```

**Expected response:**
```json
{
  "ok": true,
  "text": "Hello! How can I help you today?",
  "raw": { /* full Gemini response */ }
}
```

## Configuration Options

### Environment Variables (wrangler.toml)

```toml
[vars]
ALLOWED_ORIGIN = "https://akobaloyi.github.io"
```

### Secrets (via wrangler secret)

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put SANDBOX_DEV_TOKEN
```

### View Current Secrets

```bash
wrangler secret list
```

### Update Secrets

```bash
wrangler secret put SECRET_NAME
# Enter new value
```

### Delete Secrets

```bash
wrangler secret delete SECRET_NAME
```

## Custom Domain Setup

### Option 1: Workers.dev Subdomain (Free)

Your worker is automatically available at:
```
https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev
```

### Option 2: Custom Domain

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. Go to Settings → Triggers
5. Click "Add Custom Domain"
6. Enter your domain (e.g., `api.yourdomain.com`)
7. Cloudflare automatically configures DNS

**Update frontend:**
```javascript
const WORKER_URL = 'https://api.yourdomain.com';
```

## Monitoring & Logs

### View Real-time Logs

```bash
wrangler tail
# or
npm run tail
```

### Cloudflare Dashboard

1. Go to Workers & Pages
2. Select your worker
3. View metrics:
   - Requests per second
   - Error rate
   - CPU time
   - Success rate

### Set Up Alerts

1. Cloudflare Dashboard → Notifications
2. Create alert for:
   - High error rate
   - Unusual traffic
   - Rate limit hits

## Troubleshooting

### "API key not configured"

```bash
wrangler secret put GEMINI_API_KEY
# Paste your Gemini API key
```

### "KV namespace not found"

1. Create namespace: `wrangler kv:namespace create "RATE_LIMIT"`
2. Update `wrangler.toml` with the ID
3. Redeploy: `wrangler deploy`

### "Unauthorized: Invalid origin or token"

**For production (from akobaloyi.github.io):**
- No token needed, origin is automatically validated

**For development:**
```bash
curl -H "x-sandbox-token: YOUR_DEV_TOKEN" ...
```

### CORS Errors

Check `ALLOWED_ORIGIN` in `wrangler.toml` matches your frontend domain exactly:
```toml
[vars]
ALLOWED_ORIGIN = "https://akobaloyi.github.io"
```

### Rate Limit Issues

**Increase limit** (edit `src/index.js`):
```javascript
const RATE_LIMIT_MAX = 100; // Increase from 60
```

**Check KV namespace** is properly configured in `wrangler.toml`

## Cost Breakdown

### Free Tier Limits

- **Requests**: 100,000/day
- **CPU Time**: 10ms per request
- **KV Reads**: 100,000/day
- **KV Writes**: 1,000/day

### Paid Plan ($5/month)

- **Requests**: 10 million/month
- **CPU Time**: 50ms per request
- **KV**: Additional operations available

### Typical Usage

For AI Security Sandbox:
- ~1,000 requests/day = **FREE**
- ~10,000 requests/day = **FREE**
- ~100,000 requests/day = **FREE** (at limit)

## Security Checklist

- [x] API key stored as Worker secret
- [x] Origin validation enabled
- [x] Rate limiting configured
- [x] CORS properly set
- [x] Error messages don't leak sensitive info
- [x] KV namespace for persistent rate limiting
- [x] Development token for testing

## Maintenance

### Update Worker Code

1. Edit `src/index.js`
2. Test locally: `wrangler dev`
3. Deploy: `wrangler deploy`

### Rotate API Key

```bash
# Get new key from Google
wrangler secret put GEMINI_API_KEY
# Paste new key
```

### Monitor Usage

Check Cloudflare Dashboard daily for:
- Request volume
- Error rates
- Rate limit hits
- Unusual patterns

## Next Steps

1. ✅ Deploy worker
2. ✅ Test with curl
3. ✅ Update frontend to use worker URL
4. ✅ Remove config.js from frontend
5. ✅ Test from production domain
6. ✅ Monitor for 24 hours
7. ✅ Set up alerts

---

**Questions?** Check the main README.md or Cloudflare Workers documentation.

---

## Create LEADERBOARD KV namespace

The anonymous leaderboard (entries + per-IP submit counters) uses a dedicated KV
namespace bound as `LEADERBOARD`. This is a one-time manual step.

### Create the production namespace

```bash
cd cloudflare-worker
wrangler kv:namespace create LEADERBOARD
```

### Create the preview namespace (for `wrangler dev`)

```bash
wrangler kv:namespace create LEADERBOARD --preview
```

**Output example:**
```
🌀 Creating namespace with title "gemini-proxy-worker-LEADERBOARD"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "LEADERBOARD", id = "abc123def456" }
```

### Update `wrangler.toml`

Replace the placeholders in the `LEADERBOARD` block with the IDs returned above:

- Replace `REPLACE_WITH_KV_ID_FROM_DASHBOARD` with the `id` from `wrangler kv:namespace create LEADERBOARD`.
- Replace `REPLACE_WITH_PREVIEW_KV_ID` with the `preview_id` from `wrangler kv:namespace create LEADERBOARD --preview`.

```toml
[[kv_namespaces]]
binding = "LEADERBOARD"
id = "abc123def456"          # from wrangler kv:namespace create LEADERBOARD
preview_id = "def456abc123"  # from wrangler kv:namespace create LEADERBOARD --preview
```

> **Important:** Do not change the binding name `LEADERBOARD`. The Worker code
> references this namespace as `env.LEADERBOARD`, so renaming the binding will
> break the leaderboard endpoints.
