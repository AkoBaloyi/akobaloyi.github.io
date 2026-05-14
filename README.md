# Ako Baloyi — Portfolio

Enterprise-ready static portfolio targeting 2027 Graduate Programmes (Deloitte InfinityX, Entelect, BBD) and Junior SOC Analyst / Software Engineer roles.

Live at [akobaloyi.github.io](https://akobaloyi.github.io).

## Tech stack

- Vanilla HTML5, CSS3, JavaScript (ES6+)
- Canvas API for the particle background
- IntersectionObserver for scroll-reveal animations
- No frameworks, no build step, no runtime dependencies

## Local development

Serve from the repo root:

```bash
python -m http.server 8000
# or
npx serve
```

Then open the URL the server prints (usually http://localhost:8000).

## Deployment

GitHub Pages:

1. Push to `main`.
2. Repository settings → Pages → set source to `main` (root).
3. Wait for the deploy and visit the published URL.

## OG banner upload (ACTION REQUIRED)

Upload a 1200×630px professional image to `assets/og-banner.jpg` to activate social preview cards. The Open Graph and Twitter Card meta tags in `index.html` already point to that path.

## File map

- `index.html` — single-page site, all sections
- `styles.css` — all styles, design tokens, responsive rules
- `script.js` — particle canvas, scroll-reveal, easter eggs
- `favicon.svg` — site icon
- `assets/` — static media (currently holds the placeholder `.gitkeep`)
- `sandbox/` — separate sandbox/learning environment
- `cloudflare-worker/` — optional Cloudflare Workers backend for chat sandbox
- `.kiro/` — spec artifacts (requirements, design, tasks) and steering rules
