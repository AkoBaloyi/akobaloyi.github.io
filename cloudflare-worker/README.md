# Gemini API Proxy - Cloudflare Worker

Secure proxy for Google Gemini API with origin validation, rate limiting, and token authentication.

## Features

- ✅ **Secure**: API key stored as Worker secret, never exposed to client
- ✅ **Origin Validation**: Only accepts requests from `https://akobaloyi.github.io`
- ✅ **Token Auth**: Development token for local testing
- ✅ **Rate Limiting**: 60 requests per 15 minutes per IP (using KV or stateless)
- ✅ **CORS**: Properly configured for your frontend
- ✅ **Error Handling**: Retry logic for upstream rate limits
- ✅ **Normalized Responses**: Consistent JSON format

## Quick Start

### 1. Install Wrangler

```bash
npm install -g wrangler
# or
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create KV Namespace (Optional but Recommended)

```bash
wrangler kv:namespace create "RATE_LIMIT"
```

Copy the `id` from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "your_kv_namespace_id_here"
```

### 4. Set Secrets

```bash
# Set your Gemini API key
wrangler secret put GEMINI_API_KEY
# Paste your key when prompted

# Set development token (for local testing)
wrangler secret put SANDBOX_DEV_TOKEN
# Enter a secure random token (e.g., generate with: openssl rand -hex 32)
```

### 5. Deploy

```bash
npm run deploy
# or
wrangler deploy
```

Your Worker will be deployed to: `https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev`

## Configuration

### Environment Variables

Set in `wrangler.toml` or Cloudflare Dashboard:

- `ALLOWED_ORIGIN` - Origin allowed to make requests (default: `https://akobaloyi.github.io`)

### Secrets

Set via `wrangler secret put`:

- `GEMINI_API_KEY` - Your Google Gemini API key (required)
- `SANDBOX_DEV_TOKEN` - Token for development/testing (optional)

### KV Namespace

For production rate limiting, create a KV namespace:

```bash
wrangler kv:namespace create "RATE_LIMIT"
```

Update `wrangler.toml` with the namespace ID.

## API Usage

### Endpoint

```
POST https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev/api/gemini-pro
```

### Request Format

```json
{
  "model": "gemini-pro",
  "prompt": "Your prompt here",
  "type": "text",
  "options": {
    "temperature": 0.7,
    "maxOutputTokens": 500
  }
}
```

**Fields:**
- `model` (optional) - Model name (default: `gemini-pro` for text, `gemini-pro-vision` for vision)
- `prompt` (required) - Text prompt or array of parts for vision
- `type` (optional) - `"text"` or `"vision"` (helps select default model)
- `options` (optional) - Generation config (temperature, maxOutputTokens, topP, topK)

### Response Format

**Success:**
```json
{
  "ok": true,
  "text": "Generated response text",
  "raw": { /* Full Gemini API response */ }
}
```

**Error:**
```json
{
  "ok": false,
  "error": "Error message",
  "status": 400
}
```

### Authentication

The Worker accepts requests from:

1. **Origin**: `https://akobaloyi.github.io` (automatic)
2. **Token**: Include header `x-sandbox-token: YOUR_DEV_TOKEN` (for development)

### Rate Limiting

- **Limit**: 60 requests per 15 minutes per IP
- **Response**: HTTP 429 with `Retry-After` header when exceeded

## Frontend Integration

### Update Your JavaScript

Replace direct Gemini API calls with Worker proxy:

```javascript
// OLD: Direct Gemini API call
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
  { /* ... */ }
);

// NEW: Via Cloudflare Worker
const WORKER_URL = 'https://gemini-proxy-worker.YOUR_SUBDOMAIN.workers.dev';

async function callGeminiAPI(prompt, options = {}) {
  const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-pro',
      prompt: prompt,
      options: {
        temperature: 0.7,
        maxOutputTokens: 500,
        ...options
      }
    })
  });

  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.error);
  }
  
  return data.text;
}
```

### For Vision (Images)

```javascript
async function classifyImage(base64Image, prompt) {
  const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-pro-vision',
      type: 'vision',
      prompt: [
        { text: prompt },
        {
          inline_data: {
            mime_type: "image/jpeg",
            data: base64Image
          }
        }
      ],
      options: {
        temperature: 0.4,
        maxOutputTokens: 100
      }
    })
  });

  const data = await response.json();
  return data.text;
}
```

### Development with Token

For local testing (not from `akobaloyi.github.io`):

```javascript
const response = await fetch(`${WORKER_URL}/api/gemini-pro`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-sandbox-token': 'your_dev_token_here'
  },
  body: JSON.stringify({ /* ... */ })
});
```

## Development

### Local Testing

```bash
npm run dev
# or
wrangler dev
```

Test locally at: `http://localhost:8787/api/gemini-pro`

### View Logs

```bash
npm run tail
# or
wrangler tail
```

### Update Secrets

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put SANDBOX_DEV_TOKEN
```

### List Secrets

```bash
wrangler secret list
```

## Deployment

### Deploy to Production

```bash
npm run deploy
```

### Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Go to Settings → Triggers
4. Add custom domain (e.g., `api.yourdomain.com`)

Update `ALLOWED_ORIGIN` in `wrangler.toml` if needed.

## Security

### Best Practices

✅ **Never expose API key** - Always stored as Worker secret  
✅ **Origin validation** - Only your domain can access  
✅ **Rate limiting** - Prevents abuse  
✅ **CORS configured** - Blocks unauthorized origins  
✅ **Error handling** - No sensitive info in errors  

### Monitoring

1. **Cloudflare Dashboard** → Workers & Pages → Your Worker → Metrics
2. Monitor:
   - Request count
   - Error rate
   - CPU time
   - KV operations

### Rate Limit Tuning

Adjust in `src/index.js`:

```javascript
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 60; // Max requests
```

## Troubleshooting

### "API key not configured"

```bash
wrangler secret put GEMINI_API_KEY
```

### "Unauthorized: Invalid origin or token"

- Check request is from `https://akobaloyi.github.io`
- Or include `x-sandbox-token` header with valid token

### "Rate limit exceeded"

- Wait 15 minutes
- Or increase `RATE_LIMIT_MAX` in code

### KV not working

- Verify KV namespace is created and bound in `wrangler.toml`
- Check KV namespace ID is correct
- Worker will fall back to stateless mode (less effective)

### CORS errors

- Verify `ALLOWED_ORIGIN` matches your frontend domain exactly
- Check browser console for specific CORS error

## Cost Estimation

### Cloudflare Workers

- **Free Tier**: 100,000 requests/day
- **Paid**: $5/month for 10M requests

### KV Storage

- **Free Tier**: 100,000 reads/day, 1,000 writes/day
- **Paid**: $0.50/million reads, $5/million writes

### Typical Usage

For AI Security Sandbox with moderate traffic:
- ~1,000 requests/day = **FREE**
- ~10,000 requests/day = **FREE**
- ~100,000 requests/day = **FREE** (at limit)

## Support

### Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Gemini API Docs](https://ai.google.dev/docs)

### Common Issues

Check `wrangler tail` for real-time logs and errors.

## License

MIT License - See main project for details.

---

**Ready to deploy?** Follow the Quick Start steps above!
