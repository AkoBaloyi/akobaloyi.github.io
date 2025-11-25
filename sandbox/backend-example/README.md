# Backend Proxy Server

This is a simple Express.js backend that proxies requests to the Gemini API, keeping your API key secure on the server side.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your Gemini API key
   ```

3. **Run Server**
   ```bash
   # Development (with auto-reload)
   npm run dev
   
   # Production
   npm start
   ```

## Endpoints

### POST /api/gemini-pro
Chat completion endpoint for prompt injection attacks.

**Request:**
```json
{
  "prompt": "Your full prompt here"
}
```

**Response:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "AI response" }]
    }
  }]
}
```

### POST /api/gemini-vision
Image classification endpoint for adversarial attacks.

**Request:**
```json
{
  "image": "base64_encoded_image",
  "prompt": "Classify this image"
}
```

**Response:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "Classification result" }]
    }
  }]
}
```

### GET /health
Health check endpoint.

## Security Features

- ✅ API key stored in environment variables
- ✅ CORS protection
- ✅ Rate limiting (100 requests per 15 minutes per IP)
- ✅ Request validation
- ✅ Error handling

## Deployment

### Heroku
```bash
heroku create your-app-name
heroku config:set GEMINI_API_KEY=your_key_here
git push heroku main
```

### Railway
1. Connect your GitHub repo
2. Add environment variable: GEMINI_API_KEY
3. Deploy!

### Vercel/Netlify Functions
Convert to serverless functions (see their documentation)

## Update Frontend

After deploying the backend, update your frontend JavaScript:

```javascript
// Instead of calling Gemini directly:
const BACKEND_URL = 'https://your-backend.herokuapp.com';

async function callGeminiAPI(prompt) {
    const response = await fetch(`${BACKEND_URL}/api/gemini-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    return await response.json();
}
```
