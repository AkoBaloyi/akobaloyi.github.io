# Technology Stack

## Core Technologies

- **HTML5** - Semantic markup with meta tags for SEO and social sharing
- **CSS3** - Custom properties (CSS variables), Grid, Flexbox, animations
- **Vanilla JavaScript** - No frameworks or external dependencies
- **Canvas API** - Particle animation system

## Build System

**None required** - This is a static site with no build process.

## Fonts

- **Space Grotesk** - Headings (weights: 400, 500, 700)
- **Inter** - Body text (weights: 300, 400, 500)
- Loaded via Google Fonts CDN

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## Common Commands

### Development
```bash
# No build process - simply open index.html in a browser
# Or use a local server:
python -m http.server 8000
# or
npx serve
```

### Deployment
```bash
# Deploy to GitHub Pages:
# 1. Push to main branch
# 2. Enable GitHub Pages in repository settings
# 3. Select main branch as source
```

## Performance Optimizations

- RequestAnimationFrame for smooth animations
- Intersection Observer for lazy-loaded scroll animations
- Debounced scroll events
- Optimized particle count (80 particles)
- No external JavaScript libraries
