# Deployment Checklist

## ✅ Pre-Deployment

### 1. API Key Security
- [ ] **IMPORTANT**: Current API key is embedded in JavaScript files
- [ ] For production, move to environment variables or backend
- [ ] Consider rate limiting and usage monitoring
- [ ] Set up API key rotation policy

**Current locations:**
- `sandbox/assets/js/chat-attack.js` (line ~15)
- `sandbox/assets/js/image-attack.js` (line ~15)

### 2. Test All Features
- [ ] Chat Attack Simulator (all 3 difficulty levels)
- [ ] Image Attack Simulator (upload + samples)
- [ ] Data Poisoning Demo (all attack types)
- [ ] Learn section modals (all 6 topics)
- [ ] Navigation links work
- [ ] Mobile responsiveness

### 3. Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

## 🚀 Deployment Options

### Option 1: GitHub Pages (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add AI Security Sandbox with Gemini integration"
   git push origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings
   - Navigate to Pages section
   - Select "main" branch
   - Choose root directory
   - Save

3. **Access Your Site**
   - URL: `https://[username].github.io/[repo-name]/sandbox/`
   - Wait 1-2 minutes for deployment

### Option 2: Netlify

1. **Connect Repository**
   - Sign up at netlify.com
   - Click "New site from Git"
   - Connect your GitHub repo

2. **Configure Build**
   - Build command: (leave empty)
   - Publish directory: `sandbox`
   - Deploy!

3. **Custom Domain** (optional)
   - Add custom domain in Netlify settings
   - Update DNS records

### Option 3: Vercel

1. **Import Project**
   - Sign up at vercel.com
   - Click "Import Project"
   - Connect GitHub repo

2. **Configure**
   - Root directory: `sandbox`
   - Framework: None
   - Deploy!

### Option 4: Local Server (Development)

```bash
# Python
cd sandbox
python -m http.server 8000

# Node.js
npx serve sandbox

# PHP
cd sandbox
php -S localhost:8000
```

## 🔒 Security Considerations

### API Key Protection

**Current Setup (Development)**
- API key is in client-side JavaScript
- Visible to anyone who views source
- Fine for learning/demo purposes

**Production Setup (Recommended)**
1. Create a backend API endpoint
2. Store API key in environment variables
3. Proxy requests through your backend
4. Add rate limiting and authentication

**Example Backend (Node.js/Express)**
```javascript
// server.js
const express = require('express');
const app = express();

app.post('/api/gemini', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  // Forward request to Gemini API
  // Return response to client
});
```

### Rate Limiting
- Gemini API has usage limits
- Consider implementing client-side rate limiting
- Monitor usage in Google Cloud Console
- Set up billing alerts

### Content Security
- Add Content Security Policy headers
- Validate user inputs
- Sanitize displayed content
- Monitor for abuse

## 📊 Monitoring & Analytics

### Recommended Tools
- **Google Analytics**: Track user engagement
- **Sentry**: Error monitoring
- **Hotjar**: User behavior analysis
- **Google Cloud Console**: API usage monitoring

### Key Metrics to Track
- Page views per lab
- Average session duration
- Attack success rates
- API error rates
- User progression through difficulty levels

## 🔧 Post-Deployment

### 1. Test Live Site
- [ ] All labs work with real API
- [ ] No console errors
- [ ] Mobile experience is smooth
- [ ] Load times are acceptable

### 2. Monitor Usage
- [ ] Check API usage in Google Cloud Console
- [ ] Monitor for errors or abuse
- [ ] Track user engagement
- [ ] Collect feedback

### 3. Iterate
- [ ] Fix any reported bugs
- [ ] Add requested features
- [ ] Update educational content
- [ ] Improve based on analytics

## 🎯 Performance Optimization

### Current Performance
- ✅ No build process needed
- ✅ Minimal dependencies
- ✅ Static assets only
- ✅ Fast initial load

### Potential Improvements
- [ ] Add image compression for samples
- [ ] Implement lazy loading for modals
- [ ] Cache API responses where appropriate
- [ ] Add service worker for offline support
- [ ] Minify CSS/JS for production

## 📝 Documentation

### User-Facing
- ✅ README.md (overview)
- ✅ USAGE_GUIDE.md (detailed instructions)
- ✅ In-app Learn section (educational content)
- ✅ Quick tips on homepage

### Developer-Facing
- ✅ Code comments in JavaScript files
- ✅ Clear file structure
- ✅ This deployment guide
- [ ] API documentation (if adding backend)
- [ ] Contributing guidelines (if open source)

## 🐛 Known Issues & Limitations

### Current Limitations
1. **API Key Exposure**: Client-side key visible in source
2. **No User Accounts**: No progress saving across sessions
3. **No Backend**: All processing client-side
4. **Rate Limits**: Shared Gemini API limits
5. **Browser Compatibility**: Requires modern browser with Canvas API

### Future Enhancements
- [ ] User authentication and progress tracking
- [ ] Backend API for secure key management
- [ ] More attack scenarios and labs
- [ ] Leaderboard and achievements
- [ ] Community features (sharing attacks, challenges)
- [ ] Video tutorials
- [ ] Blog with writeups

## 🆘 Troubleshooting

### Common Issues

**API Errors**
- Check API key is valid
- Verify internet connection
- Check Google Cloud Console for quota
- Look for CORS issues in console

**Labs Not Loading**
- Check browser console for errors
- Verify all files are uploaded
- Check file paths are correct
- Clear browser cache

**Slow Performance**
- Check network tab for slow requests
- Verify API response times
- Consider caching strategies
- Optimize images

## 📞 Support

### For Users
- Check USAGE_GUIDE.md
- Review Learn section content
- Check browser console for errors
- Contact via email in footer

### For Developers
- Review code comments
- Check GitHub issues (if open source)
- Refer to Gemini API docs
- Test locally first

## ✅ Final Checklist

Before going live:
- [ ] Test all features thoroughly
- [ ] Review API key security
- [ ] Check mobile responsiveness
- [ ] Verify all links work
- [ ] Test on multiple browsers
- [ ] Set up monitoring
- [ ] Prepare for user feedback
- [ ] Document any custom changes
- [ ] Have rollback plan ready

---

**Ready to Deploy?** Follow the steps above and your AI Security Sandbox will be live!

**Questions?** Review the documentation or check the code comments for guidance.
