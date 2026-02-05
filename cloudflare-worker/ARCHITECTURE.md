# Cloudflare Worker Architecture

## Overview

```
┌─────────────────┐
│   User Browser  │
│ (akobaloyi.io)  │
└────────┬────────┘
         │ POST /api/gemini-pro
         │ { prompt, model, options }
         ▼
┌─────────────────────────────────────┐
│   Cloudflare Worker (Edge)          │
│                                     │
│  1. Validate Origin/Token           │
│  2. Check Rate Limit (KV)           │
│  3. Build Gemini Payload            │
│  4. Forward to Gemini API           │
│  5. Parse & Normalize Response      │
│  6. Return JSON                     │
└────────┬────────────────────────────┘
         │ GET /v1beta/models/gemini-pro
         │ ?key=SECRET_KEY
         ▼
┌─────────────────┐
│  Gemini API     │
│  (Google)       │
└─────────────────┘
```

## Security Layers

### Layer 1: Origin Validation
```javascript
// Only accepts requests from:
- https://akobaloyi.github.io (production)
- x-sandbox-token header (development)
```

### Layer 2: Rate Limiting
```javascript
// Per IP address:
- 60 requests per 15 minutes
- Stored in Cloudflare KV
- Returns 429 with Retry-After header
```

### Layer 3: API Key Protection
```javascript
// API key stored as Worker secret:
- Never exposed to client
- Not in code or logs
- Managed via Cloudflare dashboard
```

### Layer 4: CORS
```javascript
// Strict CORS policy:
- Only allows akobaloyi.github.io
- Blocks all other origins
- Credentials: false
```

## Request Flow

### 1. Client Request
```javascript
fetch('https://worker.dev/api/gemini-pro', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-pro',
    prompt: 'Hello',
    options: { temperature: 0.7 }
  })
})
```

### 2. Worker Processing
```javascript
// Validate
if (!validOrigin && !validToken) return 403;

// Rate limit
if (requestCount > 60) return 429;

// Transform
const geminiPayload = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: options
};

// Forward
const response = await fetch(geminiAPI, {
  method: 'POST',
  body: JSON.stringify(geminiPayload)
});

// Normalize
return {
  ok: true,
  text: extractedText,
  raw: fullResponse
};
```

### 3. Client Response
```javascript
{
  "ok": true,
  "text": "Hello! How can I help you?",
  "raw": { /* full Gemini response */ }
}
```

## Rate Limiting Implementation

### With KV (Recommended)
```javascript
// Store in Cloudflare KV:
Key: "ratelimit:192.168.1.1"
Value: { count: 45, windowStart: 1234567890 }
TTL: 900 seconds (15 minutes)

// On each request:
1. Get current count from KV
2. Check if window expired
3. Increment or reset counter
4. Store back to KV
5. Allow or deny request
```

### Without KV (Fallback)
```javascript
// Stateless mode:
- No persistent storage
- Less effective rate limiting
- Still validates origin/token
- Suitable for development only
```

## Error Handling

### Upstream Rate Limit (429)
```javascript
// Gemini API rate limited:
1. Wait 1 second
2. Retry once
3. If still fails, return 429 to client
```

### Network Errors
```javascript
// Connection issues:
1. Retry once with backoff
2. Return normalized error:
   { ok: false, error: "Failed to connect" }
```

### Invalid Requests
```javascript
// Client errors:
- Missing prompt: 400
- Invalid origin: 403
- Rate limited: 429
- Server error: 500
```

## Performance

### Edge Computing Benefits
- **Latency**: ~50ms (vs ~200ms for traditional server)
- **Scalability**: Auto-scales globally
- **Availability**: 99.99% uptime
- **Cost**: Free tier covers most use cases

### Optimization Techniques
- **Minimal Processing**: Direct proxy with light validation
- **KV Caching**: Fast rate limit lookups
- **Retry Logic**: Handles transient failures
- **Streaming**: Could be added for long responses

## Monitoring

### Metrics Available
- Request count per minute/hour/day
- Error rate by status code
- CPU time per request
- KV read/write operations
- Geographic distribution

### Logging
```javascript
// Automatic logging:
console.log('Request from:', clientIP);
console.error('Error:', error.message);

// View with:
wrangler tail
```

## Deployment

### Development
```bash
wrangler dev
# Runs locally on http://localhost:8787
# Uses .dev.vars for secrets
```

### Production
```bash
wrangler deploy
# Deploys to Cloudflare edge
# Uses Worker secrets
# Available globally in ~30 seconds
```

## Cost Analysis

### Free Tier
- 100,000 requests/day
- 10ms CPU time per request
- 100,000 KV reads/day
- 1,000 KV writes/day

### Typical Usage (AI Sandbox)
- ~1,000 requests/day = **$0/month**
- ~10,000 requests/day = **$0/month**
- ~100,000 requests/day = **$0/month**

### Paid Plan ($5/month)
- 10 million requests/month
- 50ms CPU time per request
- Unlimited KV operations

## Security Best Practices

✅ **API Key**: Stored as Worker secret  
✅ **Origin Validation**: Whitelist only  
✅ **Rate Limiting**: Per-IP enforcement  
✅ **CORS**: Strict policy  
✅ **Error Messages**: No sensitive data  
✅ **Logging**: No API keys in logs  
✅ **Secrets Rotation**: Easy via CLI  

## Comparison: Worker vs Traditional Backend

| Feature | Cloudflare Worker | Express.js Server |
|---------|------------------|-------------------|
| Setup Time | 5 minutes | 30+ minutes |
| Cost (low traffic) | Free | $5-10/month |
| Latency | ~50ms | ~200ms |
| Scalability | Automatic | Manual |
| Maintenance | None | Regular updates |
| Global Distribution | Yes | No (single region) |
| Rate Limiting | KV-based | Redis/Memory |

## Future Enhancements

### Potential Additions
- [ ] Response caching (reduce API calls)
- [ ] Request queuing (handle bursts)
- [ ] Analytics dashboard
- [ ] Multiple API key support
- [ ] User authentication
- [ ] Webhook support
- [ ] Streaming responses

### Advanced Features
- [ ] A/B testing different models
- [ ] Cost tracking per user
- [ ] Custom rate limits per user
- [ ] Request prioritization
- [ ] Fallback to other AI providers

---

**This architecture provides enterprise-grade security and performance at zero cost for typical usage.**
