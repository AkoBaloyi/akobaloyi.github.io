# Setup Guide - AI Security Sandbox

## 🚀 Quick Start (Local Development)

### Option 1: Client-Side Only (Easiest)

**⚠️ WARNING: This exposes your API key in the browser. Only use for local testing!**

1. **Get a Gemini API Key**
   - Visit: https://makersuite.google.com/app/apikey
   - Sign in with Google account
   - Create a new API key
   - Copy the key

2. **Configure the API Key**
   ```bash
   cd sandbox
   cp config.example.js config.js
   ```
   
3. **Edit config.js**
   ```javascript
   window.GEMINI_API_KEY = 'YOUR_API_KEY_HERE';
   ```

4. **Start Local Server**
   ```bash
   python -m http.server 8000
   # or
   npx serve
   ```

5. **Open in Browser**
   ```
   http://localhost:8000
   ```

6. **Test the Features**
   - Try Chat Attack Simulator
   - Upload images to Image Attack
   - Experiment with Data Poisoning

### Option 2: Backend Proxy (Recommended for Production)

**✅ Secure: API key stays on server**

1. **Setup Backend**
   ```bash
   cd sandbox/backend-example
   npm install
   cp .env.example .env
   ```

2. **Configure Environment**
   Edit `.env`:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

3. **Start Backend Server**
   ```bash
   npm run dev
   ```

4. **Update Frontend**
   Edit `sandbox/assets/js/chat-attack.js` and `image-attack.js`:
   ```javascript
   // Replace direct API calls with backend proxy
   const BACKEND_URL = 'http://localhost:3000';
   
   async function callGeminiAPI(prompt) {
       const response = await fetch(`${BACKEND_URL}/api/gemini-pro`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ prompt })
       });
       return await response.json();
   }
   ```

5. **Start Frontend**
   ```bash
   cd sandbox
   python -m http.server 8000
   ```

6. **Test Everything**
   - Backend: http://localhost:3000/health
   - Frontend: http://localhost:8000

## 📦 What You Need

### For Client-Side Setup
- ✅ Web browser (Chrome, Firefox, Safari, Edge)
- ✅ Python 3 (for local server) or Node.js
- ✅ Gemini API key
- ✅ Internet connection

### For Backend Setup
- ✅ Node.js 16+ and npm
- ✅ Gemini API key
- ✅ Basic command line knowledge

## 🔐 Security Best Practices

### For Local Development
1. **Never commit config.js** - It's in .gitignore
2. **Use different keys** for dev and production
3. **Monitor API usage** in Google Cloud Console
4. **Set up billing alerts** to avoid surprises

### For Production
1. **Always use backend proxy** - Never expose keys in frontend
2. **Enable rate limiting** - Prevent abuse
3. **Use HTTPS** - Secure all connections
4. **Monitor logs** - Watch for suspicious activity
5. **Rotate keys regularly** - Change keys periodically

## 🌐 Deployment Options

### GitHub Pages (Frontend Only)

**⚠️ Requires backend proxy for API calls**

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add AI Security Sandbox"
   git push origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings
   - Navigate to Pages
   - Select "main" branch
   - Choose root directory
   - Save

3. **Deploy Backend Separately**
   - Use Heroku, Railway, or Vercel
   - See backend deployment section below

### Netlify (Full Stack)

1. **Connect Repository**
   - Sign up at netlify.com
   - Click "New site from Git"
   - Connect GitHub repo

2. **Configure Build**
   - Build command: (leave empty)
   - Publish directory: `sandbox`

3. **Add Environment Variables**
   - Go to Site settings → Environment variables
   - Add: `GEMINI_API_KEY`

4. **Deploy Functions** (optional)
   - Create `netlify/functions/` directory
   - Add serverless functions for API proxy

### Vercel (Full Stack)

1. **Import Project**
   - Sign up at vercel.com
   - Click "Import Project"
   - Connect GitHub repo

2. **Configure**
   - Root directory: `sandbox`
   - Framework: None

3. **Add Environment Variables**
   - Go to Settings → Environment Variables
   - Add: `GEMINI_API_KEY`

4. **Deploy API Routes** (optional)
   - Create `api/` directory
   - Add serverless functions

## 🖥️ Backend Deployment

### Heroku

```bash
cd sandbox/backend-example
heroku create your-app-name
heroku config:set GEMINI_API_KEY=your_key_here
git push heroku main
```

### Railway

1. Connect GitHub repo
2. Add environment variable: `GEMINI_API_KEY`
3. Deploy automatically

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Add environment variable
4. Deploy

### DigitalOcean App Platform

1. Create new app
2. Connect GitHub repo
3. Add environment variable
4. Deploy

## 🧪 Testing Your Setup

### Test Checklist

- [ ] **Config loaded**: Check browser console for API key warnings
- [ ] **Chat Attack works**: Try sending a message
- [ ] **Image Attack works**: Upload or select an image
- [ ] **Data Poisoning works**: Add poison and train model
- [ ] **Learn section works**: Click topic cards to open modals
- [ ] **No console errors**: Check browser developer tools
- [ ] **Mobile responsive**: Test on phone/tablet

### Common Issues

**"API Key Not Configured"**
- Solution: Create `config.js` from `config.example.js`
- Check: File is in `sandbox/` directory
- Verify: API key is correct

**"CORS Error"**
- Solution: Use local server, not file:// protocol
- Run: `python -m http.server 8000`
- Access: http://localhost:8000

**"Failed to fetch"**
- Check: Internet connection
- Verify: API key is valid
- Check: Google Cloud Console for quota
- Try: Different browser

**"Rate limit exceeded"**
- Wait: 15 minutes for rate limit reset
- Check: Google Cloud Console usage
- Consider: Implementing caching

## 📊 Monitoring & Maintenance

### Monitor API Usage

1. **Google Cloud Console**
   - Visit: https://console.cloud.google.com
   - Navigate to APIs & Services
   - Check quotas and usage

2. **Set Up Alerts**
   - Create billing alerts
   - Monitor daily usage
   - Set spending limits

### Update Dependencies

```bash
cd sandbox/backend-example
npm update
npm audit fix
```

### Rotate API Keys

1. Create new key in Google Cloud Console
2. Update environment variables
3. Test with new key
4. Delete old key
5. Update documentation

## 🆘 Getting Help

### Resources

- **Gemini API Docs**: https://ai.google.dev/docs
- **GitHub Issues**: Report bugs and request features
- **USAGE_GUIDE.md**: Detailed usage instructions
- **DEPLOYMENT.md**: Production deployment guide

### Troubleshooting Steps

1. Check browser console for errors
2. Verify API key is configured
3. Test with sample data first
4. Check network tab for failed requests
5. Review server logs (if using backend)
6. Try different browser
7. Clear cache and cookies

## ✅ Pre-Deployment Checklist

Before pushing to GitHub:

- [ ] Remove API key from all JavaScript files
- [ ] Add `config.js` to .gitignore
- [ ] Test with `config.example.js` template
- [ ] Verify backend proxy works (if using)
- [ ] Update README with setup instructions
- [ ] Test on clean clone of repository
- [ ] Check for any hardcoded secrets
- [ ] Review all console.log statements
- [ ] Test all features work without API key in code

## 🎓 Next Steps

After setup:

1. **Learn the Basics** - Read the Learn section
2. **Try Easy Mode** - Start with Chat Attack on Easy
3. **Experiment** - Try different attack techniques
4. **Progress** - Move to Medium and Hard difficulties
5. **Build Defenses** - Think about how to protect against these attacks
6. **Share** - Deploy and share with others (securely!)

---

**Need help?** Check USAGE_GUIDE.md for detailed instructions on using each feature.

**Ready to deploy?** See DEPLOYMENT.md for production deployment strategies.
