# Ako Baloyi · Portfolio

Personal portfolio for Ako Baloyi, final-year BEngSc student at Wits University and Co-Founder of Adigital.

Live at [akobaloyi.github.io](https://akobaloyi.github.io).

## Stack

Vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no runtime dependencies. The particle background uses the Canvas API; the scroll reveal uses an IntersectionObserver.

## Run it locally

From the repo root:

```bash
python -m http.server 8000
```

Or:

```bash
npx serve
```

Then open whatever URL the server prints (usually http://localhost:8000).

## Deploy

GitHub Pages, off `main`. Push, then enable Pages in repo settings with `main` (root) as the source.

## Files

- `index.html` · single page, all sections
- `styles.css` · styles and responsive rules
- `script.js` · particle canvas, scroll reveal, easter eggs
- `favicon.svg` · site icon
- `assets/` · static media (drop `og-banner.jpg`, 1200x630, here for social previews)
- `sandbox/` · separate AI security sandbox
- `cloudflare-worker/` · Cloudflare Worker proxy for the sandbox chat
