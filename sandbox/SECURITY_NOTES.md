# Security Notes - API Key Management

## ⚠️ CRITICAL: API Key Security

### What Changed

**Before:** API key was hardcoded in JavaScript files  
**After:** API key is loaded from external config file (gitignored)

### Files Modified

1. **sandbox/assets/js/chat-attack.js**
   - Removed hardcoded API key
   - Now loads from `window.GEMINI_API_KEY`
   - Added validation and error messages

2. **sandbox/assets/js/image-attack.js**
   - Removed hardcoded API key
   - Now loads from `window.GEMINI_API_KEY`
   - Added validation and error messages

3. **sandbox/sandbox/chat-attack.html**
   - Added `<script src="../config.js"></script>`
   - Loads before main JavaScript

4. **sandbox/sandbox/image-attack.html**
   - Added `<script src="../config.js"></script>`
   - Loads before main JavaScript

### Files Created

1. **sandbox/.gitignore** - Prevents committing sensitive files
2. **sandbox/config.js** - Contains API key (GITIGNORED)
3. **sandbox/config.example.js** - Template for users
4. **.gitignore** (root) - Project-wide ignore rules

### How It Works Now

#### Local Development
```javascript
// config.js (gitignored)
window.GEMINI_API_KEY = 'your_actual_key';

// chat-attack.js
const GEMINI_API_KEY = window.GEMINI_API_KEY || '';
if (!GEMINI_API_KEY) {
    console.error('API Key Not Configured');
}
```

#### For Other Users
1. Clone repository
2. Copy `config.example.js` to `config.js`
3. Add their own API key
4. Start using the sandbox

## 🔒 Security Layers

### Layer 1: .gitignore
```
# Prevents committing API keys
sandbox/config.js
**/config.js
*.key
.env
```

### Layer 2: Example Template
```javascript
// config.example.js (safe to commit)
window.GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
```

### Layer 3: Runtime Validation
```javascript
// Checks if key is configured
if (!GEMINI_API_KEY) {
    console.error('⚠️ API Key Not Configured');
    // Provides setup instructions
}
```

### Layer 4: Backend Proxy (Optional)
```javascript
// For production: API calls go through backend
const response = await fetch('/api/gemini-pro', {
    method: 'POST',
    body: JSON.stringify({ prompt })
});
```

## 📋 Before Committing to GitHub

### Checklist

- [x] API key removed from all JavaScript files
- [x] `config.js` added to .gitignore
- [x] `config.example.js` created as template
- [x] HTML files updated to load config
- [x] Validation added to check for API key
- [x] Error messages guide users to setup
- [x] Backend proxy example provided
- [x] Documentation updated (SETUP.md, DEPLOYMENT.md)

### Verify Security

```bash
# Check for exposed keys
git grep -i "AIzaSy" -- ':!*.md' ':!config.example.js'

# Should return no results (except in docs/examples)
```

### Safe to Commit

✅ All JavaScript files (no hardcoded keys)  
✅ HTML files (load external config)  
✅ CSS files  
✅ config.example.js (template only)  
✅ Documentation files  
✅ .gitignore files  

### Never Commit

❌ config.js (contains real API key)  
❌ .env files (environment variables)  
❌ Any file with actual API keys  
❌ node_modules/ (dependencies)  

## 🚀 Deployment Strategies

### Strategy 1: Client-Side (Development Only)

**Pros:**
- Simple setup
- No backend needed
- Fast development

**Cons:**
- API key visible in browser
- Not secure for production
- Rate limits shared

**Use for:**
- Local development
- Personal testing
- Learning purposes

### Strategy 2: Backend Proxy (Recommended)

**Pros:**
- API key stays on server
- Secure for production
- Can add rate limiting
- Can add authentication

**Cons:**
- Requires backend setup
- More complex deployment
- Additional hosting costs

**Use for:**
- Production deployment
- Public websites
- Shared access

### Strategy 3: Serverless Functions

**Pros:**
- No server management
- Auto-scaling
- Pay per use
- Secure

**Cons:**
- Platform-specific code
- Cold start delays
- Learning curve

**Use for:**
- Production deployment
- Low to medium traffic
- Cost optimization

## 🔍 Monitoring & Alerts

### Google Cloud Console

1. **Monitor Usage**
   - API calls per day
   - Quota consumption
   - Error rates

2. **Set Alerts**
   - Billing alerts
   - Quota alerts
   - Error rate alerts

3. **Review Logs**
   - Check for abuse
   - Monitor patterns
   - Identify issues

### Rate Limiting

```javascript
// Backend example
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit per IP
});
```

## 🛡️ Best Practices

### Development

1. **Use separate keys** for dev and production
2. **Never commit keys** to version control
3. **Rotate keys regularly** (monthly recommended)
4. **Monitor usage** daily during development
5. **Test with low quotas** to catch issues early

### Production

1. **Always use backend proxy** or serverless functions
2. **Implement rate limiting** per user/IP
3. **Add authentication** if needed
4. **Monitor logs** for suspicious activity
5. **Set up alerts** for unusual usage
6. **Use HTTPS** for all connections
7. **Validate inputs** on backend
8. **Cache responses** where appropriate

### Team Collaboration

1. **Each developer gets own key** for development
2. **Use environment variables** for shared keys
3. **Document setup process** clearly
4. **Review code** for exposed secrets
5. **Use secret scanning tools** in CI/CD

## 🔄 Key Rotation Process

### When to Rotate

- Monthly (scheduled)
- After team member leaves
- If key is exposed
- After security incident
- Before major deployment

### How to Rotate

1. **Create new key** in Google Cloud Console
2. **Update config.js** locally (test)
3. **Update environment variables** on server
4. **Deploy changes**
5. **Test thoroughly**
6. **Delete old key** after 24 hours
7. **Update documentation**

## 📞 Emergency Response

### If API Key is Exposed

1. **Immediately delete key** in Google Cloud Console
2. **Create new key**
3. **Update all deployments**
4. **Review usage logs** for abuse
5. **Check billing** for unexpected charges
6. **Document incident**
7. **Update security practices**

### If Unusual Activity Detected

1. **Check logs** in Google Cloud Console
2. **Identify source** of unusual requests
3. **Block IP** if malicious
4. **Rotate key** if compromised
5. **Review rate limits**
6. **Update security measures**

## ✅ Current Status

### Security Measures Implemented

- [x] API keys removed from source code
- [x] .gitignore configured properly
- [x] Config template provided
- [x] Runtime validation added
- [x] Error messages guide users
- [x] Backend proxy example created
- [x] Documentation comprehensive
- [x] Setup guide detailed

### Ready for GitHub

✅ **Safe to commit** - No API keys in tracked files  
✅ **User-friendly** - Clear setup instructions  
✅ **Secure by default** - Keys must be configured  
✅ **Production-ready** - Backend proxy available  

### Next Steps for Users

1. Clone repository
2. Follow SETUP.md instructions
3. Create config.js with their API key
4. Start using the sandbox
5. Deploy with backend proxy for production

---

**Remember:** Security is an ongoing process. Regularly review and update your security practices.
