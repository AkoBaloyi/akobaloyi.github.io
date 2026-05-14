# Implementation Plan: Portfolio Enterprise Upgrade

## Overview

Ship the six coordinated upgrades defined in `requirements.md` (REQ-1 through REQ-6) and fully specified in `design.md`. Edits are confined to `index.html`, `styles.css`, `script.js`, plus one new `assets/.gitkeep` placeholder and a rewritten `README.md`. No new runtime dependencies, no build step, no new colour tokens, no new `@keyframes`, no new breakpoints.

All verbatim copy (hero headline, experience bullets, project card paragraphs, certification cards, skills lists, education paragraphs) lives in `requirements.md` and MUST be lifted from there. This task document specifies **where things go, how they are wired, and the exact CSS / HTML skeletons** that carry no copy of their own.

The task list is flat and DAG-ready: every task is independently runnable given its upstream `Depends on` list. The `## Task Dependency Graph` at the end groups tasks into execution waves for parallel scheduling.

## Tasks

- [x] 1. Insert Open Graph and Twitter Card meta block into `<head>`
  - Open `index.html` and locate the existing `<meta name="description" …>` tag inside `<head>`. Insert the full 17-line OG / Twitter block from `requirements.md` REQ-1 §5 on the line immediately after `<meta name="description">`, before `<title>`. Remove the five superseded lines currently in `<head>` (`og:title`, `og:description`, `og:type`, `og:image`, `twitter:card`, `twitter:title`, `twitter:description`) — they are replaced by the new block in place. Preserve every other meta tag (charset, viewport, description, icon, preconnects, stylesheet link) untouched. Keep the `<!-- ACTION REQUIRED: Upload a 1200×630px professional banner to /assets/og-banner.jpg -->` HTML comment exactly where REQ-1 §5 places it (immediately above `og:image`).
  - **Files:** `index.html`
  - **Requirements:** REQ-1 (all clauses), Design §6.2
  - **Depends on:** none

- [x] 2. Rewrite the Hero section copy
  - In `index.html`, locate `<section id="home" class="hero">` and update only the text content inside `.hero-content`. Replace the contents of `<h1 class="glitch" data-text="Ako Baloyi">` with the exact headline from REQ-2 §1. Replace the `<p class="hero-subtitle">` body with the exact two-sentence sub-headline from REQ-2 §2. Update the existing CTA `<a>` so `href="mailto:Akobaloyi01@gmail.com"` and the visible label reads `Get In Touch`; keep its `class="cta-button"`. Do NOT alter the surrounding `<canvas id="particle-canvas">`, wrapper `<div>`s, section classes, or any attribute the particle init or typing animation in `script.js` reads (the typing animation will automatically pick up the new `<h1>` text content on next load). Copy strings live in REQ-2 §§1–3 — lift them from there.
  - **Files:** `index.html`
  - **Requirements:** REQ-2 (all clauses), Design §2 (Hero row)
  - **Depends on:** 1

- [x] 3. Insert the Experience section
  - In `index.html`, immediately after the closing `</section>` of `<section id="home" class="hero">` and before `<section id="projects" …>`, insert the full HTML block from REQ-3 §5 verbatim. Add the `fade-in` class to `.experience-card` (per Design §2) so the card animates in on scroll: `<div class="experience-card fade-in">`. The three bullet copy strings and the external links (`https://adigital.co.za`, `https://renke.co.za`) MUST be preserved verbatim from REQ-3 §5. External links keep `target="_blank" rel="noopener noreferrer"`.
  - **Files:** `index.html`
  - **Requirements:** REQ-3 (all clauses), Design §2 (Experience row), Design §3.1
  - **Depends on:** 2

- [x] 4. Append Experience section CSS to `styles.css`
  - Append the following CSS block verbatim to `styles.css`, positioned after the last existing section block (the Footer block) and before the `/* ===== Fade-in Animation ===== */` block. Uses only existing `:root` tokens and the sanctioned `rgba(108, 99, 255, 0.05–0.3)` violet-glow family.
  - **Files:** `styles.css`
  - **Requirements:** REQ-3 (clauses 4, 5), Design §4.1 (placement), Design §4.2 (Experience block)
  - **Depends on:** 3

  ```css
  /* ===== Experience Section ===== */
  .experience-card {
      background: var(--bg-secondary);
      border: 1px solid rgba(108, 99, 255, 0.2);
      border-left: 4px solid var(--accent-violet);
      border-radius: 15px;
      backdrop-filter: blur(10px);
      padding: 2rem;
      transition: var(--transition);
      position: relative;
  }

  .experience-card:hover {
      border-color: var(--accent-violet);
      box-shadow: 0 0 20px rgba(108, 99, 255, 0.2);
      transform: translateY(-3px);
  }

  .experience-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
  }

  .experience-role {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 1.35rem;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
  }

  .experience-company {
      color: var(--accent-violet);
      font-weight: 500;
      font-size: 1rem;
  }

  .experience-company a {
      color: inherit;
      transition: var(--transition);
  }

  .experience-company a:hover {
      color: var(--accent-cyan);
      text-shadow: 0 0 10px rgba(112, 224, 255, 0.3);
  }

  .experience-date {
      color: var(--accent-cyan);
      font-weight: 500;
      font-size: 0.95rem;
      white-space: nowrap;
      padding: 0.25rem 0.75rem;
      background: rgba(108, 99, 255, 0.08);
      border: 1px solid rgba(108, 99, 255, 0.2);
      border-radius: 20px;
  }

  .experience-bullets {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
  }

  .experience-bullets li {
      position: relative;
      padding-left: 1.5rem;
      color: var(--text-secondary);
      line-height: 1.7;
  }

  .experience-bullets li::before {
      content: '▸';
      position: absolute;
      left: 0;
      top: 0;
      color: var(--accent-violet);
      font-weight: 700;
  }

  .experience-bullets li a {
      color: var(--accent-cyan);
      transition: var(--transition);
      border-bottom: 1px solid rgba(112, 224, 255, 0.3);
  }

  .experience-bullets li a:hover {
      color: var(--accent-violet);
      border-bottom-color: var(--accent-violet);
  }
  ```

  Extend the existing `@media (max-width: 480px)` block at the bottom of `styles.css` (do NOT create a new media query) by appending:

  ```css
      /* Enterprise upgrade: Experience card at 480px */
      .experience-card { padding: 1.25rem; }
      .experience-role { font-size: 1.15rem; }
  ```

  And extend the existing `@media (max-width: 768px)` block (do NOT create a new media query) by appending:

  ```css
      /* Enterprise upgrade: stack Experience header at 768px */
      .experience-header {
          flex-direction: column;
          align-items: flex-start;
      }
  ```

- [x] 5. Rebuild the Featured Projects section
  - In `index.html`, inside `<section id="projects" class="section section-dark">`, replace the three existing `.project-card` blocks with three new cards in the exact order required by REQ-4 §1: (1) renke.co.za — Production Client Site, (2) AVR Safe Lock System — Bare-Metal Firmware, (3) Android + AWS — Cloud-Native Mobile App. Each card follows this DOM shape:
    ```
    <div class="project-card fade-in">
      <div class="project-content">
        <span class="project-badge">{badge}</span>
        <h3>{title}</h3>
        <p>{STAR paragraph 1}</p>
        <p>{STAR paragraph 2}</p>
        <p class="project-result">{result line}</p>
        <div class="project-tags">
          <span>{tag}</span> …
        </div>
        <div class="project-links">
          <a href="{url}" target="_blank" rel="noopener noreferrer">View Live Site</a>
          <a href="#" aria-label="GitHub repository (URL pending)">GitHub</a><!-- TODO: add repo URL -->
        </div>
      </div>
    </div>
    ```
  - Lift every string (badge, title, both STAR paragraphs, result line, tag list) verbatim from REQ-4 §5 (Card 1), §6 (Card 2), §7 (Card 3). Card 1's "View Live Site" button links to `https://renke.co.za`. Card 2 has only a GitHub link slot; Cards 2 and 3 use `href="#"` + `<!-- TODO: add repo URL -->` + `aria-label="GitHub repository (URL pending)"` exactly as REQ-4 §4 requires. Preserve the surrounding `<div class="projects-grid">` wrapper and the closing `<p class="projects-tagline">I don't just build tools, I build understanding</p>` already in the section. Keep `.project-card` `.fade-in` for the existing Intersection Observer.
  - **Files:** `index.html`
  - **Requirements:** REQ-4 (all clauses), Design §2 (Projects row), Design §3.2
  - **Depends on:** 3

- [x] 6. Append Project Card additions CSS to `styles.css`
  - Append the following CSS block verbatim to `styles.css`, placed after the Experience block added in task 4 and before the Certifications block that task 8 will add. The existing `.project-card`, `.project-content`, `.project-tags` rules already in `styles.css` stay untouched — only the two new children (`.project-badge`, `.project-result`) are added. `.project-result` binds its colour to `var(--accent-cyan)` per Design §3.2.
  - **Files:** `styles.css`
  - **Requirements:** REQ-4 (clauses 2, 3), Design §4.1 (placement), Design §4.2 (Project Card additions)
  - **Depends on:** 4, 5

  ```css
  /* ===== Project Card additions ===== */
  .project-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      margin-bottom: 1rem;
      background: rgba(108, 99, 255, 0.15);
      border: 1px solid rgba(108, 99, 255, 0.3);
      border-radius: 20px;
      color: var(--accent-violet);
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
  }

  .project-result {
      margin: 1.25rem 0;
      padding: 0.85rem 1rem;
      background: rgba(112, 224, 255, 0.05);
      border-left: 3px solid var(--accent-cyan);
      border-radius: 4px;
      color: var(--accent-cyan);
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      font-size: 0.95rem;
      line-height: 1.5;
  }
  ```

  Also extend the existing `@media (max-width: 480px)` block at the bottom of `styles.css` by appending:

  ```css
      /* Enterprise upgrade: project badge at 480px */
      .project-badge { font-size: 0.75rem; }
  ```

- [x] 7. Replace the Skills DNA section with the Security Posture & Skills section
  - In `index.html`, locate the existing `<section id="skills" class="section section-dark">` block (the "Tools & Skills DNA" block with `.skills-strip`) and **replace it in full** with the verbatim HTML skeleton below. Place the new section immediately after `<section id="projects" …>`, preserving document order Hero → Experience → Projects → Security → About (per Design §1). The certification issuer / name strings come from REQ-5 §2; the five skill groups and their tag strings come from REQ-5 §4 (every skill tag lifted verbatim). `.fade-in` is applied to both `.cert-grid` and `.skills-grid` so the existing Intersection Observer reveals them on scroll.
  - **Files:** `index.html`
  - **Requirements:** REQ-5 (all clauses), Design §2 (Security row), Design §3.3, §3.4
  - **Depends on:** 5

  ```html
  <!-- Security Posture & Skills Section -->
  <section id="security" class="section section-dark">
      <div class="container">
          <h2 class="section-title fade-in">Security Posture &amp; Skills</h2>

          <div class="cert-grid fade-in">
              <div class="cert-card cert-card--violet">
                  <p class="cert-issuer">Fortinet</p>
                  <h3 class="cert-name">Fortinet Certified Associate (FCA) — Cybersecurity</h3>
              </div>
              <div class="cert-card cert-card--cyan">
                  <p class="cert-issuer">Microsoft</p>
                  <h3 class="cert-name">Microsoft Cybersecurity Essentials</h3>
              </div>
          </div>

          <div class="skills-grid fade-in">
              <div class="skill-group">
                  <h4 class="skill-group-label">Languages</h4>
                  <div class="skill-tags">
                      <span class="skill-tag">AVR Assembly</span>
                      <span class="skill-tag">Java (Android)</span>
                      <span class="skill-tag">JavaScript (ES6+)</span>
                      <span class="skill-tag">Python</span>
                      <span class="skill-tag">HTML5</span>
                      <span class="skill-tag">CSS3</span>
                  </div>
              </div>

              <div class="skill-group">
                  <h4 class="skill-group-label">Cloud &amp; DevOps</h4>
                  <div class="skill-tags">
                      <span class="skill-tag">AWS (backend services)</span>
                      <span class="skill-tag">Cloudflare Workers</span>
                      <span class="skill-tag">GitHub Pages</span>
                      <span class="skill-tag">DNS Management</span>
                      <span class="skill-tag">SSL/TLS</span>
                  </div>
              </div>

              <div class="skill-group">
                  <h4 class="skill-group-label">Embedded</h4>
                  <div class="skill-tags">
                      <span class="skill-tag">ATmega328P</span>
                      <span class="skill-tag">I2C Protocol</span>
                      <span class="skill-tag">Hardware Interrupts</span>
                      <span class="skill-tag">Timer/Counter Config</span>
                      <span class="skill-tag">Bare-Metal Firmware</span>
                  </div>
              </div>

              <div class="skill-group">
                  <h4 class="skill-group-label">Web &amp; APIs</h4>
                  <div class="skill-tags">
                      <span class="skill-tag">Vanilla JS</span>
                      <span class="skill-tag">Canvas API</span>
                      <span class="skill-tag">Node.js / Express</span>
                      <span class="skill-tag">REST APIs</span>
                      <span class="skill-tag">Semantic HTML</span>
                      <span class="skill-tag">CSS Grid/Flex</span>
                  </div>
              </div>

              <div class="skill-group">
                  <h4 class="skill-group-label">Security &amp; Tools</h4>
                  <div class="skill-tags">
                      <span class="skill-tag">Fortinet NSE</span>
                      <span class="skill-tag">Network Security Fundamentals</span>
                      <span class="skill-tag">Microsoft Security</span>
                      <span class="skill-tag">Git</span>
                      <span class="skill-tag">Threat Analysis</span>
                  </div>
              </div>
          </div>
      </div>
  </section>
  ```

- [x] 8. Append Certifications and Skills CSS to `styles.css`
  - Append the following two CSS blocks verbatim to `styles.css`, placed after the Project Card additions added in task 6 and before the `/* ===== Fade-in Animation ===== */` block. Then append the responsive overrides **inside** the existing `@media (max-width: 768px)` and `@media (max-width: 480px)` blocks — do NOT create any new media query blocks (REQ constraint: no new breakpoints).
  - **Files:** `styles.css`
  - **Requirements:** REQ-5 (all clauses), Design §4.1 (placement), Design §4.2 (Certifications + Skills blocks), Design §4.3 (responsive overrides)
  - **Depends on:** 6, 7

  ```css
  /* ===== Certifications ===== */
  .cert-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
  }

  .cert-card {
      background: var(--bg-secondary);
      border: 1px solid rgba(108, 99, 255, 0.2);
      border-radius: 15px;
      backdrop-filter: blur(10px);
      padding: 2rem;
      transition: var(--transition);
      position: relative;
  }

  .cert-card--violet {
      border-left: 4px solid var(--accent-violet);
  }

  .cert-card--cyan {
      border-left: 4px solid var(--accent-cyan);
  }

  .cert-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 0 20px rgba(108, 99, 255, 0.2);
  }

  .cert-card--cyan:hover {
      box-shadow: 0 0 20px rgba(112, 224, 255, 0.2);
  }

  .cert-issuer {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      font-size: 0.8rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
  }

  .cert-name {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
      line-height: 1.3;
  }

  .cert-card--violet .cert-sub {
      color: var(--accent-cyan);
  }

  .cert-card--cyan .cert-sub {
      color: var(--accent-violet);
  }

  .cert-sub {
      font-size: 0.9rem;
      font-weight: 500;
  }
  ```

  ```css
  /* ===== Skills (grouped) ===== */
  .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
  }

  .skill-group {
      background: var(--bg-secondary);
      border: 1px solid rgba(108, 99, 255, 0.2);
      border-radius: 15px;
      backdrop-filter: blur(10px);
      padding: 1.75rem;
      transition: var(--transition);
  }

  .skill-group:hover {
      border-color: rgba(108, 99, 255, 0.3);
      box-shadow: 0 0 15px rgba(108, 99, 255, 0.15);
      transform: translateY(-3px);
  }

  .skill-group-label {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-size: 1rem;
      color: var(--accent-violet);
      margin-bottom: 1rem;
      letter-spacing: 0.04em;
  }

  .skill-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
  }

  .skill-tag {
      padding: 0.3rem 0.8rem;
      background: var(--bg-primary);
      border: 1px solid rgba(108, 99, 255, 0.2);
      border-radius: 20px;
      font-size: 0.85rem;
      color: var(--accent-cyan);
      transition: var(--transition);
      cursor: default;
  }

  .skill-tag:hover {
      background: var(--accent-violet);
      color: var(--bg-primary);
      border-color: var(--accent-violet);
      transform: scale(1.05);
  }
  ```

  Extend the existing `@media (max-width: 768px)` block by appending:

  ```css
      /* Enterprise upgrade: collapse Certifications + Skills grids at 768px */
      .cert-grid,
      .skills-grid {
          grid-template-columns: 1fr;
      }
  ```

  Extend the existing `@media (max-width: 480px)` block by appending:

  ```css
      /* Enterprise upgrade: tighten Certifications + Skills at 480px */
      .cert-card,
      .skill-group {
          padding: 1.25rem;
      }
      .cert-name { font-size: 1.1rem; }
      .skill-tag { font-size: 0.8rem; }
  ```

- [x] 9. Rewrite the About / Education section
  - In `index.html`, locate `<section id="about" class="section">` and replace the inner `.container` contents with:
    - the existing `<h2 class="section-title fade-in">` updated to an appropriate Education heading (e.g. `Education`),
    - an `<h3>` containing the exact education heading from REQ-6 §4 verbatim,
    - two `<p class="about-text fade-in">` paragraphs containing REQ-6 §4 P1 and P2 verbatim.
  - Remove the existing `.microcopy` block and the `.principles-grid` (four `.principle-card` elements) — REQ-6 §3 caps the section at at most two body paragraphs below the education heading. Do NOT change the wrapping `<section id="about" class="section">` element, its `id`, or its `.section` class — the navbar `#about` anchor must continue to resolve. `.fade-in` on the paragraphs reuses the existing Intersection Observer.
  - **Files:** `index.html`
  - **Requirements:** REQ-6 (all clauses), Design §2 (About row)
  - **Depends on:** 7

- [x] 10. Confirm scroll-reveal coverage for new sections
  - Open `script.js` and locate the existing Intersection Observer setup (the `const observer = new IntersectionObserver(...)` block followed by `document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));`). Verify the selector `.fade-in` already catches every new revealable element added by tasks 3, 5, 7, 9 (`.experience-card.fade-in`, `.project-card.fade-in`, `.cert-grid.fade-in`, `.skills-grid.fade-in`, new `.about-text.fade-in` paragraphs). If the existing site also uses a `.reveal` class for scroll reveal (search `styles.css` and `index.html` for `.reveal`), extend the existing selector in place to `document.querySelectorAll('.fade-in, .reveal')` — do NOT add a new observer, do NOT rewrite the existing observer logic, and do NOT introduce any new `@keyframes`. Then sweep the new HTML in `index.html` (tasks 3, 5, 7, 9) and confirm the `.fade-in` class is present on the correct wrapper elements per the skeletons in those tasks; add it to any missed wrapper without touching unrelated markup.
  - **Files:** `script.js`, `index.html` (class attributes only)
  - **Requirements:** Design §5 (JavaScript Integration), Design Constraints §Animation
  - **Depends on:** 3, 5, 7, 9

- [x] 11. Update the `<title>` tag
  - In `index.html`, replace the existing `<title>Ako Baloyi | Portfolio</title>` with, exactly: `<title>Ako Baloyi — Co-Founder, Adigital · Software Engineer & Cybersecurity</title>`. Use the em dash `—` (U+2014) and middle-dot `·` (U+00B7) as shown. Change no other tags.
  - **Files:** `index.html`
  - **Requirements:** Design §6.1
  - **Depends on:** 1

- [x] 12. Create `assets/.gitkeep` placeholder
  - Create a new empty file at `assets/.gitkeep` at the repo root. The purpose is solely to make git track the `assets/` directory before `assets/og-banner.jpg` is uploaded — the banner is referenced by the OG / Twitter meta tags added in task 1 but is a downstream manual asset drop. Do not create `assets/og-banner.jpg` itself; keep the `<!-- ACTION REQUIRED … -->` comment added in task 1 as the in-document flag for that upload.
  - **Files:** `assets/.gitkeep`
  - **Requirements:** REQ-1 (clause 3), Design §1 (Files Touched table, `assets/.gitkeep` row), Design §6.3
  - **Depends on:** 1

- [x] 13. Rewrite `README.md`
  - Overwrite `README.md` at the repo root with a concise project README (no marketing fluff). Include the following sections in order:
    - **Title + one-line summary:** Ako Baloyi's portfolio — an enterprise-ready static site targeting 2027 Graduate Programmes (Deloitte InfinityX, Entelect, BBD) and Junior SOC Analyst / Software Engineer roles.
    - **Tech stack:** vanilla HTML5, CSS3, JavaScript. No build step, no frameworks, no runtime dependencies.
    - **Local development:** run either `python -m http.server 8000` or `npx serve` from the repo root and open the reported URL.
    - **Deployment:** GitHub Pages — push to `main`, enable Pages in repository settings, select the `main` branch as source.
    - **OG banner upload (ACTION REQUIRED):** a line reading exactly `Upload a 1200×630px professional image to \`assets/og-banner.jpg\` to activate social preview cards.`
    - **File map:** short bullet list of top-level files and their roles: `index.html`, `styles.css`, `script.js`, `favicon.svg`, `assets/`, `sandbox/`, `cloudflare-worker/`, `.kiro/`.
  - Keep the README short and scanning-friendly — no extended prose, no badges, no marketing taglines.
  - **Files:** `README.md`
  - **Requirements:** REQ-1 (banner upload instruction), Design §10 (Rollout & Verification — documenting the manual asset drop)
  - **Depends on:** 12

## Verification Checklist

Manual verification steps distilled from Design §10 (Rollout & Verification). Run through each after task 13 completes.

- **Cross-browser sanity.** Open `index.html` in Chrome, Firefox, and Safari. Confirm the loading spinner → particle canvas → hero text sequence still runs and the typing animation on the new `<h1>` fires once.
- **Document order.** In each browser, scan the page top to bottom and confirm: Hero → Experience → Projects → Security & Skills → About → Mindset → Personal → In Motion → Purpose → Contact → Footer.
- **Viewport sweep.** Resize DevTools through 1200 → 768 → 480 → 320px. Confirm `.experience-header` stacks at ≤ 768px, `.cert-grid` and `.skills-grid` collapse to a single column at ≤ 768px, card padding tightens at ≤ 480px, no horizontal scroll at 320px, and the particle canvas keeps rendering at every width.
- **Scroll reveal.** Scroll slowly from top to bottom. Confirm `.fade-in` reveal fires on every new card: `.experience-card`, every `.project-card`, both `.cert-card` elements, every `.skill-group` inside `.skills-grid`, and the new `.about-text` paragraphs.
- **DevTools Console clean.** Open DevTools → Console. Confirm no CSS warnings (unknown property, invalid value), no JS errors, and the existing `console.log` easter-egg messages still appear.
- **Head inspection.** In DevTools → Elements → `<head>`, confirm the OG / Twitter block sits immediately after `<meta name="description">`, `<title>` reads the new string from task 11, and the `<!-- ACTION REQUIRED: … -->` comment is present above `og:image`.
- **Network 404 sweep.** In DevTools → Network with cache disabled, reload. Confirm the only expected 404 is `assets/og-banner.jpg` (until the banner is uploaded) — no other resource 404s are introduced.
- **LinkedIn Post Inspector.** After redeploying to `https://akobaloyi.github.io`, paste the URL into the LinkedIn Post Inspector. Confirm the title leads with "Co-Founder" and the description includes "BEngSc" and "Adigital". The image slot will render as broken until the banner is uploaded — expected.
- **Meta-tag debugger.** Paste the live URL into `https://www.opengraph.xyz/` or `https://metatags.io/`. Confirm all 13 `og:*` / `twitter:*` tags from REQ-1 §5 are present and correctly paired.

## Notes

- No tasks are marked optional (`*`). The Correctness Properties section is intentionally omitted — `design.md` has already justified skipping property-based tests for this static-site content, layout, and meta-tag upgrade.
- Every task references the exact requirements and design sections it implements, so an executing subagent can pick up any task independently given its `Depends on` list.
- CSS blocks inside tasks 4, 6, and 8 and the HTML skeleton inside task 7 are the **normative, lift-verbatim** payloads for those tasks.
- All verbatim copy (hero, experience bullets, project cards, education paragraphs) is sourced from `requirements.md`, not this document. Implementers open `requirements.md` alongside this file.
- No new runtime dependencies, no build step, no new colour tokens, no new `@keyframes`, no new breakpoints.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "12"] },
    { "id": 2, "tasks": ["3", "13"] },
    { "id": 3, "tasks": ["4", "5"] },
    { "id": 4, "tasks": ["6", "7"] },
    { "id": 5, "tasks": ["8", "9"] },
    { "id": 6, "tasks": ["10"] },
    { "id": 7, "tasks": ["11"] }
  ]
}
```
