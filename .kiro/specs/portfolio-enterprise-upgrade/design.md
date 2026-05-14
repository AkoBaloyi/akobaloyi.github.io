# Design Document

## Introduction

This design translates the six approved requirements in `requirements.md` (REQ-1 OG/Twitter meta, REQ-2 Hero rewrite, REQ-3 Experience section, REQ-4 Featured Projects STAR rework, REQ-5 Security Posture & Skills, REQ-6 About/Education) into the concrete markup, class, and CSS contracts that implementation tasks will lift directly.

The upgrade ships as edits to three existing files — `index.html`, `styles.css`, `script.js` — plus one new asset directory (`assets/`) holding a placeholder OG banner slot. No new JavaScript files, no new CSS files, no new runtime dependencies, no new colour tokens, no new `@keyframes`, no new breakpoints. Everything composes onto the existing design system: `--bg-primary` / `--bg-secondary` / `--text-primary` / `--text-secondary` / `--accent-violet` / `--accent-cyan`, Space Grotesk for headings, Inter for body, the glassmorphism card recipe (`background: var(--bg-secondary)` + `border: 1px solid rgba(108, 99, 255, 0.2)` + `backdrop-filter: blur(10px)`), the existing `.fade-in` + Intersection Observer scroll-reveal pattern, and the existing 768px / 480px breakpoints.

For all verbatim copy (OG block strings, hero headline, experience bullets, project card paragraphs, skills lists, education paragraphs), `requirements.md` is the source of truth. This design document specifies **structure, class contracts, insertion points, CSS, and responsive behaviour** — it intentionally does not restate copy.

---

## 1. Architecture Overview

### Files Touched

| File | Change |
|---|---|
| `index.html` | Head meta block extended (REQ-1); hero copy rewritten (REQ-2); new `#experience` section inserted (REQ-3); `#projects` section rebuilt (REQ-4); existing `#skills` "Skills DNA" section replaced with new `#security` Security Posture & Skills section (REQ-5); existing `#about` section repurposed to Education / positioning copy (REQ-6). |
| `styles.css` | New component blocks appended after existing section blocks, preceding the Responsive Design media-query block, which is extended with the new component overrides (REQ-3/4/5/6). |
| `script.js` | One targeted change: extend the Intersection Observer target list so the new cards animate in on scroll. No architectural change, no new files. |
| `assets/.gitkeep` | New empty file so git tracks the directory the OG banner will eventually live in. `assets/og-banner.jpg` is referenced by meta tags but not shipped yet; an HTML comment in `<head>` flags the upload as an outstanding action (REQ-1 §3). |

### Document Order (post-upgrade)

```
Loading Screen
  └─ Navigation (fixed)
Hero                              #home        (REQ-2)
Experience                        #experience  (REQ-3)  ← NEW, placed before Projects
Projects                          #projects    (REQ-4)  ← restructured
Security Posture & Skills         #security    (REQ-5)  ← replaces old Skills DNA
About / Education                  #about       (REQ-6)  ← repurposed; preserves #about anchor
Mindset                           #mindset
Personal                          #personal
In Motion                         #motion
Purpose                           #purpose
Contact                           #contact
Footer
```

**About placement note.** REQ-6 requires an About/Education section, and the navigation currently uses the `#about` anchor. The requirements doc does not pin About's position in the page order; this design places About/Education between Security & Skills and Mindset so the upper half of the page reads as a CV spine (Experience → Projects → Skills/Certs → Education) before transitioning into the narrative lower half (Mindset → Personal → In Motion → Purpose → Contact). The `id="about"` is preserved so existing `#about` nav links continue to resolve.

### Why This Order

- Recruiter-priority content (commercial experience, projects, credentials) lives above the fold and in the first three scrolls.
- Credentials (certs + skills + education) cluster together so a SOC/graduate-programme reviewer can scan posture in one region.
- Narrative sections (Mindset → Purpose) stay intact below the resume spine, preserving the site's existing personality.

---

## 2. Document Structure (`index.html`)

Skeleton of sections and their contained class hierarchy. Copy is referenced to `requirements.md`, not restated here. New/changed elements are marked **NEW** or **CHG**.

| Section | Outer element & id | Inner hierarchy (classes) | Notes |
|---|---|---|---|
| Meta (head) | `<head>` | new OG + Twitter block (REQ-1 §5) **CHG** | Inserted **immediately after** the existing `<meta name="description">` line. Existing superseded `og:*` / `twitter:*` tags are replaced in place; unrelated meta tags (charset, viewport, description, theme-color) are preserved. `<title>` is updated (see §6). |
| Hero | `<section id="home" class="hero">` **CHG** | `#particle-canvas` → `.hero-content` → `.glitch h1` + `.hero-subtitle` + `.cta-button` | Only text content and CTA target change; canvas + particle init in `script.js` preserved. |
| Experience | `<section id="experience" class="section">` **NEW** | `.container` → `h2.section-title` → `.experience-card.fade-in` → `.experience-header` → (`.experience-role`, `.experience-company`) + `.experience-date` → `ul.experience-bullets > li` × 3 | HTML is REQ-3 §5 verbatim, with `.fade-in` added to the card for scroll reveal. |
| Projects | `<section id="projects" class="section section-dark">` **CHG** | `.container` → `h2.section-title` → `.projects-grid` → `.project-card.fade-in` × 3 → `.project-content` → `.project-badge` + `h3` + 2×`<p>` + `.project-result` + `.project-tags > span` pills + link row | Existing `.project-card` / `.project-content` / `.project-tags` classes reused. New child classes `.project-badge` and `.project-result` are added. Placeholder GitHub links use `href="#"` + adjacent `<!-- TODO: add repo URL -->` comment per REQ-4 §4. |
| Security & Skills | `<section id="security" class="section">` **NEW** (replaces old `id="skills"`) | `.container` → `h2.section-title` → `.cert-grid` → `.cert-card.cert-card--violet.fade-in` + `.cert-card.cert-card--cyan.fade-in` → (`.cert-issuer`, `.cert-name`, `.cert-sub`) → `.skills-grid.fade-in` → `.skill-group` × 5 → (`h4.skill-group-label`, `.skill-tags > span.skill-tag`) | Old `#skills` / `.skills-strip` block removed. See §3 for full skeleton. |
| About / Education | `<section id="about" class="section section-dark">` **CHG** | `.container` → `h2.section-title` → `h3` (education heading, REQ-6 §4) → `p.edu-meta` (optional meta line) → 2 × `<p class="about-text fade-in">` | Existing `#about` anchor preserved. Principles grid & microcopy from the old About section are removed; REQ-6 prescribes at most two body paragraphs. |
| Mindset | `<section id="mindset">` | unchanged | |
| Personal | `<section id="personal">` | unchanged | |
| In Motion | `<section id="motion">` | unchanged | |
| Purpose | `<section id="purpose">` | unchanged | |
| Contact | `<section id="contact">` | unchanged | |
| Footer | `<footer>` | unchanged | |

### Insertion Points (exact)

- **OG/Twitter block** — inserted on the line immediately after `<meta name="description" …>`, before `<title>`.
- **`<title>`** — existing tag is rewritten in place (see §6).
- **Experience section** — inserted as the next sibling after the closing `</section>` of `#home` (Hero), and before `#projects`.
- **Security & Skills section** — replaces the existing `<section id="skills" class="section section-dark">` block in its entirety.
- **About / Education section** — the existing `<section id="about" class="section">` block is rewritten in place. Its position in the document is moved from "after Hero" to "after Security & Skills, before Mindset".

---

## 3. Component Contracts

Every component below reads only from the six `:root` tokens (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent-violet`, `--accent-cyan`), plus the violet-glow `rgba(108, 99, 255, 0.0X)` family restricted to the 0.05–0.3 opacity range already used site-wide.

### 3.1 Experience Card

- **Classes (DOM shape):**
  - `.experience-card` — outer glassmorphism container.
    - `.experience-header` — flex row containing the role/company block on the left and the date on the right.
      - wrapper `<div>` holding `.experience-role` (h3) + `.experience-company` (p, contains the external `<a>` to adigital.co.za).
      - `.experience-date` — span, right-aligned.
    - `.experience-bullets` — `<ul>`, three `<li>` bullets.
- **Tokens read:**
  - `background: var(--bg-secondary)`
  - `color: var(--text-primary)` for role, `var(--text-secondary)` for bullets
  - `.experience-role` accent uses `var(--accent-violet)`; `.experience-date` uses `var(--accent-cyan)`
  - Left border stripe uses `var(--accent-violet)` (4px) per REQ-3 §4
  - Outer border uses `rgba(108, 99, 255, 0.2)` (glassmorphism recipe)
- **Responsive:**
  - ≤ 768px: `.experience-header` stacks vertically (flex-direction column, gap 0.5rem), `.experience-date` aligns left.
  - ≤ 480px: padding reduces from 2rem to 1.25rem; `.experience-role` font-size clamps.

### 3.2 Project Card additions (`.project-badge`, `.project-result`)

Reuses the existing `.project-card` / `.project-content` / `.project-tags` wrapper & pill styling. Two new children are added inside `.project-content`:

- `.project-badge` — pill rendered above the title. Reads `var(--accent-violet)` text + `rgba(108, 99, 255, 0.15)` background + 1px `rgba(108, 99, 255, 0.3)` border.
- `.project-result` — result line rendered below the two STAR paragraphs and above the tags row. Reads `color: var(--accent-cyan)` per REQ-4 §3 ("results line SHALL be visually distinct by being rendered in `--accent-cyan`"). Font is Space Grotesk 500 to differentiate from body.

GitHub placeholder links use `href="#"`, `aria-label="GitHub repository (URL pending)"`, and are followed immediately by `<!-- TODO: add repo URL -->` in the markup.

### 3.3 Certifications (`.cert-grid`, `.cert-card`, variants)

- **Classes:**
  - `.cert-grid` — CSS Grid, `repeat(auto-fit, minmax(280px, 1fr))`, gap 1.5rem. Section-level layout per the "CSS Grid for section layouts" constraint.
  - `.cert-card` — glassmorphism card; base background/border/backdrop-filter match the recipe.
  - `.cert-card--violet` — left border `4px solid var(--accent-violet)`.
  - `.cert-card--cyan` — left border `4px solid var(--accent-cyan)`.
  - `.cert-issuer` — small caps label, `var(--text-secondary)`.
  - `.cert-name` — primary h3, Space Grotesk 700, `var(--text-primary)`.
  - `.cert-sub` — optional subtitle/domain line, `var(--accent-cyan)` on the violet card and `var(--accent-violet)` on the cyan card to maintain visual tension.
- **Responsive:**
  - ≤ 768px: grid collapses to single column.
  - ≤ 480px: padding reduces, `.cert-name` font-size drops to 1.1rem.

### 3.4 Skills (`.skills-grid`, `.skill-group`, pills)

- **Classes:**
  - `.skills-grid` — CSS Grid, `repeat(auto-fit, minmax(240px, 1fr))`, gap 1.5rem; section-level layout.
  - `.skill-group` — glassmorphism card per recipe.
  - `.skill-group-label` — `<h4>`, Space Grotesk 700, `var(--accent-violet)`, margin-bottom 1rem.
  - `.skill-tags` — flex row, wrap, gap 0.5rem; component-internal layout (Flexbox per constraint).
  - `.skill-tag` — pill. Reuses the visual of the existing `.project-tags span` pill (REQ-5 §5 forbids introducing a new pill class).
- **Responsive:**
  - ≤ 768px: grid collapses to single column, tag pills wrap naturally.
  - ≤ 480px: pill font-size drops to 0.8rem.

### 3.5 About / Education Meta (`.edu-meta`)

- Single paragraph class applied below the `h3` education heading and above the two body paragraphs.
- Reads `color: var(--accent-cyan)`, Inter 400, letter-spacing 0.02em. Purely a typographic utility for the date/institution line if the implementer chooses to split it out; the raw heading text in REQ-6 §4 already embeds it, so `.edu-meta` is optional.

---

## 4. CSS Design

### 4.1 Placement in `styles.css`

New rules are appended **after** the last existing section block (the `/* ===== Footer ===== */` block) and **before** the `/* ===== Fade-in Animation ===== */` block, in this order:

1. `/* ===== Experience Section ===== */`
2. `/* ===== Project Card additions ===== */` (badge + result line only; existing `.project-card` rules stay)
3. `/* ===== Certifications ===== */`
4. `/* ===== Skills (grouped) ===== */`
5. `/* ===== About / Education additions ===== */` (just `.edu-meta`, minimal)

The existing `@media (max-width: 768px)` and `@media (max-width: 480px)` blocks at the bottom of the file are **extended in place** with the new component overrides — no new media query blocks are created.

### 4.2 Normative CSS Blocks

Implementers lift the following blocks verbatim. Every value uses only the existing `:root` tokens plus the sanctioned `rgba(108, 99, 255, 0.05–0.3)` violet-glow family.

#### Experience

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

#### Project Card additions

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

#### Certifications

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

#### Skills

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

#### About / Education addition

```css
/* ===== About / Education additions ===== */
.edu-meta {
    color: var(--accent-cyan);
    font-weight: 500;
    letter-spacing: 0.02em;
    margin: 0.5rem auto 1.5rem;
    text-align: center;
    max-width: 800px;
}
```

### 4.3 Responsive Overrides (extend existing media blocks)

Appended **inside** the existing `@media (max-width: 768px)` block, at the end:

```css
    /* Enterprise upgrade: stack & relax new components at 768px */
    .experience-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .cert-grid,
    .skills-grid {
        grid-template-columns: 1fr;
    }
```

Appended **inside** the existing `@media (max-width: 480px)` block, at the end:

```css
    /* Enterprise upgrade: tighten spacing at 480px */
    .experience-card,
    .cert-card,
    .skill-group {
        padding: 1.25rem;
    }

    .experience-role { font-size: 1.15rem; }
    .cert-name       { font-size: 1.1rem; }
    .skill-tag       { font-size: 0.8rem; }
    .project-badge   { font-size: 0.75rem; }
```

### 4.4 Animation Rule

No new `@keyframes`. Scroll reveal is achieved by adding the existing `.fade-in` class to the new card and grid elements so the existing Intersection Observer (`script.js`, Scroll Reveal block) adds `.visible` to them as they enter the viewport. No new animation primitives are introduced.

---

## 5. JavaScript Integration

`script.js` already runs:

```js
document.querySelectorAll('.fade-in').forEach(el => {
    observer.observe(el);
});
```

**That line already covers the upgrade.** Because every new revealable element (`.experience-card`, `.cert-grid`, `.cert-card`, `.skills-grid`, `.project-card` rebuilds) will carry `.fade-in` as a markup class, no change to the observer logic is required.

The only JS-side modification that this design sanctions — if the implementer judges it useful — is a single-line extension of the selector to also catch elements carrying a `.reveal` class should the steering docs later prefer that token:

```js
document.querySelectorAll('.fade-in, .reveal').forEach(el => observer.observe(el));
```

This keeps both class names as valid reveal hooks while honouring the constraint that only existing `script.js` is modified. No new JS files, no new observer instances, no new animation state.

---

## 6. Meta / Head Changes

### 6.1 `<title>`

The existing `<title>Ako Baloyi | Portfolio</title>` is rewritten in place to:

```
Ako Baloyi — Co-Founder, Adigital · Software Engineer & Cybersecurity
```

### 6.2 OG / Twitter Block

Inserted on the line immediately after the existing `<meta name="description" …>` tag and before `<title>`. The full 17-line block is specified verbatim in REQ-1 §5 — implementation lifts it directly from the requirements doc. The block includes an HTML comment immediately above `og:image`:

```html
<!-- ACTION REQUIRED: Upload a 1200×630px professional banner to /assets/og-banner.jpg -->
```

The existing (superseded) five-line block of `og:title`/`og:description`/`og:type`/`og:image`/`twitter:*` tags currently in `<head>` is **removed** as part of this replacement; unrelated meta tags (charset, viewport, description, icon, font preconnects, stylesheet link) are preserved untouched, per REQ-1 §4.

### 6.3 Asset Path

- `assets/og-banner.jpg` — referenced by `og:image` and `twitter:image`, not yet present. The banner is a downstream manual upload.
- `assets/.gitkeep` — new empty file shipped with this upgrade so git tracks the directory before the image lands. This is the only new file added by the feature.

---

## 7. Accessibility & Semantics

### IDs on new/changed sections

| Section | id |
|---|---|
| Hero | `home` (unchanged) |
| Experience | `experience` (NEW) |
| Projects | `projects` (unchanged) |
| Security & Skills | `security` (NEW, replaces `skills`) |
| About / Education | `about` (unchanged anchor, new content) |

Every new `<section>` receives an `id`, satisfying the Accessibility constraint "provide an `id` attribute on every new `<section>`".

### `aria-label` on ambiguous links

| Link | aria-label |
|---|---|
| GitHub placeholder on Card 1, 2, 3 (`href="#"`) | `"GitHub repository (URL pending)"` |
| `adigital.co.za` external link in Experience company | `"Adigital — opens in new tab"` |
| `renke.co.za` external link in Experience bullet and Project 1 live site link | `"renke.co.za — opens in new tab"` |
| Certification issuer links (if any are added later) | `"{issuer name} certification page"` |

All external links keep `target="_blank" rel="noopener noreferrer"` as already used elsewhere on the site.

### Heading Hierarchy

```
h1        Hero headline
h2.section-title   One per major section (Experience, Projects, Security, About, …)
h3        Card titles: .experience-role, .cert-name, project titles, education H3
h4        .skill-group-label (Languages / Cloud & DevOps / Embedded / Web & APIs / Security & Tools)
```

No heading level is skipped within a section. h4 appears only inside `.skill-group` and is semantically subordinate to the section's h2.

### Keyboard / Focus

All interactive elements in the new sections are native `<a>` or `<button>` elements styled via existing `.cta-button`, `.contact-link`, or pill styles. No custom `role="button"` divs are introduced. The existing `:focus` behaviour (inherited from browser defaults) continues to apply; if a future pass adds explicit focus-visible rings, it can reuse the same violet-glow family without changing this design.

---

## 8. Data & Copy Sources

All verbatim strings live in `requirements.md`. This design document intentionally **does not** restate them; it only specifies where they go. Implementation tasks pull strings from the locations below:

| Copy | Source in `requirements.md` |
|---|---|
| OG / Twitter meta block (17 lines verbatim) | REQ-1 §5 |
| `<title>` replacement string | Designed in §6 above (derived from REQ-1 title) |
| "ACTION REQUIRED" HTML comment for banner | REQ-1 §3 |
| Hero h1 headline | REQ-2 §1 |
| Hero sub-headline (two sentences) | REQ-2 §2 |
| Hero CTA label + `mailto:` href | REQ-2 §3 |
| Experience section HTML (full block, verbatim) | REQ-3 §5 |
| Project Card 1 (badge, title, P1, P2, result, tags, links) | REQ-4 §5 |
| Project Card 2 | REQ-4 §6 |
| Project Card 3 | REQ-4 §7 |
| Certification 1 (Fortinet FCA) | REQ-5 §2 |
| Certification 2 (Microsoft Cybersecurity Essentials) | REQ-5 §2 |
| Skill group labels + skill tag strings (all 5 groups) | REQ-5 §4 |
| Education H3 line | REQ-6 §4 |
| About/Education P1 + P2 | REQ-6 §4 |

If any copy ambiguity surfaces during implementation, the requirements doc — not this design doc — is the source of truth.

---

## 9. Design Constraints Checklist

Cross-cutting rules every implementation task must honour:

- [ ] Colours sourced **only** from the six `:root` tokens; no new hex values, no new custom properties for colour.
- [ ] Typography: Space Grotesk (700) for headings, Inter (300–500) for body, Courier New restricted to existing terminal/log accents only.
- [ ] Glassmorphism recipe on every new card: `background: var(--bg-secondary)` + `border: 1px solid rgba(108, 99, 255, 0.2)` + `backdrop-filter: blur(10px)`.
- [ ] Violet-glow rgba opacities stay within the 0.05–0.3 range already present on site.
- [ ] CSS Grid for section layouts (`.cert-grid`, `.skills-grid`, `.projects-grid`); Flexbox for component internals (`.experience-header`, `.skill-tags`, project link rows).
- [ ] Breakpoints: 768px and 480px only; no new breakpoints.
- [ ] No new `@keyframes`; scroll reveal reuses `.fade-in` + existing Intersection Observer.
- [ ] No new JS files; no changes to particle canvas, navbar, mobile menu, quote rotator, contact form, easter eggs, cursor glow.
- [ ] No new runtime dependencies, build tools, package managers, or external libraries.
- [ ] Every new `<section>` carries an `id`; every ambiguous link carries an `aria-label`; all external links keep `target="_blank" rel="noopener noreferrer"`.
- [ ] Placeholder GitHub links use `href="#"` + adjacent `<!-- TODO: add repo URL -->` comment (REQ-4 §4).

---

## 10. Rollout & Verification

### Manual verification (local, no build)

1. Open `index.html` directly in Chrome, then Firefox, then Safari. Confirm:
   - Loading spinner → particle canvas → hero text appears in order; typing animation on h1 runs once.
   - Document order matches §1: Hero → Experience → Projects → Security & Skills → About → Mindset → Personal → In Motion → Purpose → Contact → Footer.
   - Each new section renders with the copy prescribed in the requirements map (§8), with no visible Lorem ipsum / placeholder except the sanctioned `<!-- TODO: add repo URL -->` comments and the "ACTION REQUIRED" banner comment.
   - Navbar `#about` link still scrolls to the repurposed About/Education section.
2. Resize the viewport through 1200 → 768 → 480 → 320px and confirm:
   - `.experience-header` stacks at ≤ 768px.
   - `.cert-grid` and `.skills-grid` collapse to a single column at ≤ 768px.
   - Padding tightens on cards at ≤ 480px; no horizontal scroll at 320px.
   - Particle canvas keeps rendering at all widths.
3. Scroll slowly from top to bottom. Confirm `.fade-in` reveal fires on every new card (`.experience-card`, `.project-card`, `.cert-card`, `.skills-grid`, `.about-text`).
4. Open DevTools → Console. Confirm:
   - No CSS warnings (unknown property, invalid value).
   - No JS errors.
   - The existing `console.log` easter-egg messages still appear.
5. Open DevTools → Elements → `<head>`. Confirm:
   - OG/Twitter block sits immediately after `<meta name="description">`.
   - `<title>` reads the new string.
   - `<!-- ACTION REQUIRED: … -->` comment is present above `og:image`.
6. Open DevTools → Network → disable cache, reload. Confirm `assets/og-banner.jpg` request 404s (expected until the banner is uploaded) and no other 404s are introduced.

### OG / Twitter preview verification

Once the site is redeployed to `https://akobaloyi.github.io`:

1. Paste the URL into the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/). Expected: title leads with "Co-Founder", description includes BEngSc + Adigital, image slot shown as broken until banner is uploaded.
2. Paste into a generic meta-tag debugger (e.g. `https://www.opengraph.xyz/` or `https://metatags.io/`). Confirm all 13 `og:*` / `twitter:*` tags from REQ-1 §5 are present and correctly paired.
3. Drop the URL into a WhatsApp or Slack chat to confirm title + description render (image will render only once `assets/og-banner.jpg` is uploaded).

### Post-banner-upload verification

After uploading `assets/og-banner.jpg` (1200×630px, JPG or PNG):

- Re-run LinkedIn Post Inspector and click "Re-scrape" so the cache is refreshed.
- Confirm the banner renders with no letterboxing and that text remains legible at the small thumbnail size used in LinkedIn feed previews.

### Testing Strategy — why PBT does not apply

This feature is a pure content / layout / meta-tag upgrade on a static site:

- No pure functions are introduced.
- No input-varying business logic exists.
- No serializer, parser, or data transformation is added.
- All observable behaviour is visual and deterministic given the DOM.

Under the workflow's PBT-applicability rules (UI rendering / configuration validation / static-site content are explicit non-applicable categories), **property-based testing is not appropriate**, and no Correctness Properties section is generated. Verification is covered by the manual steps above, plus the existing browser-support matrix (Chrome, Firefox, Safari, Edge, mobile) called out in `.kiro/steering/tech.md`. If the portfolio later grows a pure-logic module (e.g. a client-side parser, a scoring function), PBT can be introduced targeted at that module alone without retroactively applying it to this upgrade.
