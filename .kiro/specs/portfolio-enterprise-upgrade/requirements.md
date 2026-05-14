# Requirements Document

## Introduction

This feature upgrades `akobaloyi.github.io` from a university student portfolio into an enterprise-ready engineering portfolio targeting 2027 Graduate Programmes (Deloitte InfinityX, Entelect, BBD) and Junior SOC Analyst / Software Engineer roles.

The upgrade introduces six coordinated changes across `index.html`, `styles.css`, and `script.js`:

1. Open Graph and Twitter Card meta tags for recruiter-grade link previews.
2. A rewritten Hero section positioning Ako as Co-Founder and full-stack engineer.
3. A new Experience section placed before Projects, led by the Adigital entry.
4. A restructured Featured Projects section using STAR-format copy.
5. A Security Posture and Skills section with certification cards and grouped skill pills.
6. A refined About / Education section that frames the final module as evidence of momentum.

All changes honour the existing design system: only CSS custom properties defined in `:root` of `styles.css` may be used for colour, Space Grotesk and Inter remain the only content typefaces (Courier New stays restricted to terminal accents), and no new runtime dependencies are introduced. The glassmorphism card language, `.reveal` / Intersection Observer scroll-reveal pattern, existing breakpoints (768px, 480px), and particle canvas are preserved.

## Glossary

- **Portfolio_Site**: The static site served from `akobaloyi.github.io`, composed of `index.html`, `styles.css`, and `script.js`.
- **Head_Element**: The `<head>` block in `index.html` containing meta tags, link tags, and the `<title>` element.
- **Hero_Section**: The `<section id="home" class="hero">` block at the top of `index.html`, including the particle canvas and primary headline.
- **Experience_Section**: The new `<section id="experience">` introduced by REQ-3, placed before the Projects section.
- **Projects_Section**: The `<section id="projects">` block listing featured project cards.
- **Security_Skills_Section**: The section introduced by REQ-5 that contains the certifications cards and the grouped skills grid.
- **About_Section**: The About / Education section introduced or updated by REQ-6, containing the BEngSc education entry and the two-paragraph positioning copy.
- **EARS**: Easy Approach to Requirements Syntax — a family of structured requirement patterns (Ubiquitous, Event-driven, State-driven, Unwanted-event, Optional-feature, Complex) used to write unambiguous "SHALL" statements.
- **STAR**: Situation, Task, Action, Result — a storytelling structure used in the project cards to describe context, the action taken, and the measurable outcome.
- **Glassmorphism**: The card styling used across the site, defined by `background: var(--bg-secondary)`, `border: 1px solid rgba(108, 99, 255, 0.2)`, and `backdrop-filter: blur(10px)`.
- **OG (Open Graph)**: A Facebook-originated meta-tag protocol (`og:*` properties) used by LinkedIn, WhatsApp, Slack, iMessage, and other platforms to render link previews.
- **Twitter Card**: Twitter/X's equivalent link-preview protocol using `twitter:*` meta tags.
- **Canonical URL**: The authoritative URL for a page declared via `og:url` / `twitter:url`, used by social scrapers to deduplicate previews.
- **AVR Assembly**: Assembly language for Atmel AVR 8-bit microcontrollers, written directly against the CPU's register map and memory-mapped I/O.
- **ATmega328P**: The 8-bit AVR microcontroller targeted by the Safe Lock System project (the same chip used on the Arduino Uno, programmed here without any Arduino/HAL layer).
- **I2C**: Inter-Integrated Circuit — a two-wire serial bus used for peripheral communication in the Safe Lock System.
- **Hardware Interrupt**: A CPU-level signal that suspends current execution to run an interrupt service routine; used in the lock's state machine.
- **AWS**: Amazon Web Services — the cloud provider hosting the backend of the Android + AWS project.
- **Cloudflare Workers**: Cloudflare's serverless edge-compute platform; referenced in the Cloud & DevOps skill group.
- **SOC Analyst**: Security Operations Centre Analyst — a target role for the cybersecurity track of this portfolio.
- **BEngSc**: Bachelor of Engineering Science — the degree Ako is completing at Wits University.

## Requirements

### Requirement 1 — Open Graph & Twitter Card Meta Tags

**User Story:** As a recruiter who receives a link to `akobaloyi.github.io`, I want the link preview on LinkedIn or email to immediately communicate Ako's Co-Founder status and technical focus, so I am compelled to click through.

#### Acceptance Criteria

1. WHEN a social platform or messaging client scrapes the URL of the Portfolio_Site, THE Head_Element SHALL expose Open Graph and Twitter Card meta tags providing title, description, image, and canonical URL sufficient to render a rich link preview.
2. THE Open Graph title meta tag SHALL lead with the literal string "Co-Founder" and SHALL include the disciplines "Software Engineer" and "Cybersecurity."
3. WHERE no Open Graph banner image has yet been uploaded to `/assets/og-banner.jpg`, THE `og:image` meta tag SHALL reference the placeholder URL `https://akobaloyi.github.io/assets/og-banner.jpg` and THE Head_Element SHALL contain an HTML comment instructing the developer to upload a 1200×630px professional banner to that path.
4. WHEN the new Open Graph and Twitter Card tags are added, THE Head_Element SHALL insert them immediately after the existing `<meta name="description">` tag and SHALL preserve every existing meta tag (description, keywords, theme-color, and any prior `og:*` / `twitter:*` tags being superseded SHALL be replaced, not removed alongside unrelated tags).
5. THE Head_Element SHALL contain the following tags verbatim, placed immediately after the existing `<meta name="description">` tag:

```html
<!-- Open Graph / LinkedIn / WhatsApp -->
<meta property="og:type"        content="website" />
<meta property="og:url"         content="https://akobaloyi.github.io" />
<meta property="og:title"       content="Ako Baloyi — Co-Founder, Adigital · Software Engineer & Cybersecurity Specialist" />
<meta property="og:description" content="Final-year BEngSc candidate at Wits University and Co-Founder of Adigital (adigital.co.za). I build across the full stack — bare-metal AVR Assembly, AWS cloud applications, and live client deployments. Targeting 2027 Graduate Programmes in software engineering and cybersecurity." />
<!-- ACTION REQUIRED: Upload a 1200×630px professional banner to /assets/og-banner.jpg -->
<meta property="og:image"       content="https://akobaloyi.github.io/assets/og-banner.jpg" />
<meta property="og:image:width"  content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name"   content="Ako Baloyi — Portfolio" />
<meta property="og:locale"      content="en_ZA" />

<!-- Twitter / X Card -->
<meta name="twitter:card"        content="summary_large_image" />
<meta name="twitter:url"         content="https://akobaloyi.github.io" />
<meta name="twitter:title"       content="Ako Baloyi — Co-Founder, Adigital · Software Engineer & Cybersecurity Specialist" />
<meta name="twitter:description" content="Final-year BEngSc candidate at Wits University and Co-Founder of Adigital. Embedded systems, cloud architecture, cybersecurity. Targeting 2027 Graduate Programmes." />
<meta name="twitter:image"       content="https://akobaloyi.github.io/assets/og-banner.jpg" />
```

### Requirement 2 — Hero Section

**User Story:** As a recruiter landing on the site, I want the first thing I read to instantly communicate Ako's seniority and breadth, so I do not categorise him as a generic student.

#### Acceptance Criteria

1. THE Hero_Section SHALL present a primary `<h1>` containing the exact headline text "Engineering Systems. Securing Networks. Shipping Products." and SHALL NOT use any generic "Hi, I'm X" phrasing.
2. THE Hero_Section SHALL present a sub-headline paragraph containing exactly the following two sentences verbatim: "I am a final-year BEngSc student at Wits University and Co-Founder of Adigital — a live digital agency building real systems for real clients. From bare-metal AVR Assembly and interrupt-driven embedded firmware to AWS-backed cloud applications and production web deployments, I operate across the full engineering stack with commercial accountability."
3. THE Hero_Section SHALL present a call-to-action button with the exact label "Get In Touch", whose `href` attribute SHALL equal `mailto:Akobaloyi01@gmail.com`, and whose styling SHALL reuse the existing `.cta-button` (primary call-to-action) class rather than introducing a new button style.
4. WHEN the Hero_Section content is updated, THE Portfolio_Site SHALL preserve the existing particle canvas element, its initialization in `script.js`, and any existing scroll-reveal / entry animations so that only the text content of the hero changes.

### Requirement 3 — Experience Section

**User Story:** As a technical recruiter at Deloitte, Entelect, or BBD, I want to see commercial work experience listed first — before projects and education — so I can immediately assess Ako's real-world accountability.

#### Acceptance Criteria

1. THE Portfolio_Site SHALL include a `<section id="experience" class="section">` element, and the Experience_Section SHALL appear in the document order before the Projects_Section.
2. THE Experience_Section SHALL contain exactly one entry, and that entry SHALL be the Adigital Co-Founder & Lead Engineer entry.
3. THE Adigital entry SHALL present three bullet points whose subject matter SHALL be, in order, (a) system architecture, (b) production deployment, and (c) business / client accountability — and each bullet SHALL describe a specific engineering or commercial responsibility rather than a generic task.
4. THE Experience_Section card SHALL use `background: var(--bg-secondary)` and a left border in `--accent-violet`, reusing the existing glassmorphism card language (no new colour tokens).
5. THE Experience_Section SHALL render the following HTML structure and copy verbatim:

```html
<section id="experience" class="section">
  <div class="container">
    <h2 class="section-title">Experience</h2>

    <div class="experience-card">
      <div class="experience-header">
        <div>
          <h3 class="experience-role">Co-Founder &amp; Lead Engineer</h3>
          <p class="experience-company">
            <a href="https://adigital.co.za" target="_blank" rel="noopener noreferrer">
              Adigital
            </a>
          </p>
        </div>
        <span class="experience-date">2024 – Present</span>
      </div>

      <ul class="experience-bullets">
        <li>
          Architected and deployed full-stack client sites end-to-end — managing DNS
          configuration, cloud hosting provisioning, and production release cycles for
          live environments serving active business clients.
        </li>
        <li>
          Designed and implemented bespoke front-end systems and back-end service
          integrations, translating client business requirements into scalable,
          maintainable production solutions (see: <a href="https://renke.co.za"
          target="_blank" rel="noopener noreferrer">renke.co.za</a>).
        </li>
        <li>
          Operated as the sole technical decision-maker across all system architecture
          choices, vendor negotiations, and release cycles — building commercial
          accountability and client management experience alongside engineering output.
        </li>
      </ul>
    </div>

  </div>
</section>
```

### Requirement 4 — Featured Projects Section

**User Story:** As a hiring manager reviewing Ako's portfolio, I want each project described in terms of the problem solved and the technical decisions made — not just a list of technologies — so I can assess engineering judgement.

#### Acceptance Criteria

1. THE Projects_Section SHALL contain exactly three project cards, and THE Projects_Section SHALL present them in the following order: (1) renke.co.za — Production Client Site, (2) AVR Safe Lock System — Bare-Metal Firmware, (3) Android + AWS — Cloud-Native Mobile App.
2. THE Projects_Section SHALL present each project card's body copy in STAR format, compressed into two paragraphs where the first paragraph describes context and actions and the second paragraph describes the result.
3. THE Projects_Section SHALL present, for each project card, a project title, a "type" badge, a tech-stack tag list, and a results line, and the results line SHALL be visually distinct by being rendered in `--accent-cyan`.
4. WHERE a project's GitHub repository URL is not yet available, THE Projects_Section SHALL render the corresponding repository link slot with `href="#"` and SHALL include an adjacent HTML comment in the form `<!-- TODO: add repo URL -->` so the structure is complete and ready to populate.

5. THE Projects_Section SHALL render Card 1 with the exact copy below (badge, title, two body paragraphs, results line, tags, and link targets preserved verbatim):

- Badge: Live Deployment
- Title: renke.co.za — Production Client Site
- Body (P1): A paying client required a production-grade web presence with custom domain routing, managed hosting, and SSL — with zero tolerance for downtime. I owned the full infrastructure stack: DNS record configuration (A, CNAME, MX), cloud hosting provisioning, SSL/TLS certificate management, and deployment pipeline setup from a cold start.
- Body (P2): The site has maintained continuous uptime since launch and is actively serving clients — demonstrating that I can own a full system lifecycle, not just write front-end code.
- Result line: ✦  Live at renke.co.za — active production environment.
- Tags: DNS Management · Cloud Hosting · SSL/TLS · CI/CD · System Architecture
- Links: [View Live Site → https://renke.co.za]  [GitHub → #]

6. THE Projects_Section SHALL render Card 2 with the exact copy below (badge, title, two body paragraphs, results line, tags, and link targets preserved verbatim):

- Badge: Embedded Systems
- Title: AVR Safe Lock System — Bare-Metal Firmware
- Body (P1): The objective was to implement a hardware security mechanism at the lowest possible abstraction level — no Arduino library, no HAL, no shortcuts. I wrote the entire firmware for an ATmega328P microcontroller in bare-metal AVR Assembly: custom timer/counter configurations, I2C peripheral communication, and a hardware interrupt-driven locking state machine — all implemented directly against the CPU's register map and memory-mapped I/O addresses.
- Body (P2): This project proves I can reason at the hardware level: understanding interrupt latency, register-file constraints, clock prescaling, and real-time execution guarantees that high-level languages abstract away. That skill set maps directly to embedded security, firmware auditing, and low-level systems work.
- Result line: ✦  Fully functional interrupt-driven lock system — zero abstraction layer.
- Tags: AVR Assembly · ATmega328P · Hardware Interrupts · I2C · Timers · Bare-Metal
- Links: [GitHub → #]

7. THE Projects_Section SHALL render Card 3 with the exact copy below (badge, title, two body paragraphs, results line, tags, and link targets preserved verbatim):

- Badge: Cloud & Mobile
- Title: Android + AWS — Cloud-Native Mobile App
- Body (P1): Required a mobile-first application with a scalable, serverless backend capable of handling authentication, persistent data storage, and API management without over-engineering the infrastructure. I built the Android frontend and integrated it with AWS backend services — managing the service-to-service communication, API contracts, and data flow between the mobile client and cloud layer.
- Body (P2): This demonstrates full-stack capability that crosses the mobile/cloud boundary: understanding how mobile clients authenticate against cloud identity providers, how data is persisted and retrieved at scale, and how to design API contracts that work reliably across network conditions.
- Result line: ✦  Functioning cloud-native mobile application — mobile to cloud, end-to-end.
- Tags: Android · AWS · Cloud Architecture · REST API · Mobile Development
- Links: [GitHub → #]

### Requirement 5 — Security Posture & Skills Section

**User Story:** As a SOC team lead or cybersecurity hiring manager, I want to see Ako's certifications and technical breadth presented as a coherent security posture — not just a flat skills list.

#### Acceptance Criteria

1. THE Security_Skills_Section SHALL present certifications in a visually distinct "cert card" style, and THE certification cards SHALL appear in document order above the skills grid.
2. THE Security_Skills_Section SHALL render exactly two certification cards, with the first card bordered in `--accent-violet` and the second card bordered in `--accent-cyan`, using the following copy verbatim:
   - Cert 1 — Issuer: Fortinet; Name: Fortinet Certified Associate (FCA) — Cybersecurity; Border colour: `--accent-violet`.
   - Cert 2 — Issuer: Microsoft; Name: Microsoft Cybersecurity Essentials; Border colour: `--accent-cyan`.
3. THE Security_Skills_Section SHALL group skills into exactly five categories, rendered in this order: Languages, Cloud & DevOps, Embedded, Web & APIs, Security & Tools.
4. THE Security_Skills_Section SHALL render the five skill groups with the following exact contents (each item rendered as a tag-pill using the existing tag-pill style already used elsewhere on the Portfolio_Site):
   - Languages: AVR Assembly · Java (Android) · JavaScript (ES6+) · Python · HTML5 · CSS3
   - Cloud & DevOps: AWS (backend services) · Cloudflare Workers · GitHub Pages · DNS Management · SSL/TLS
   - Embedded: ATmega328P · I2C Protocol · Hardware Interrupts · Timer/Counter Config · Bare-Metal Firmware
   - Web & APIs: Vanilla JS · Canvas API · Node.js / Express · REST APIs · Semantic HTML · CSS Grid/Flex
   - Security & Tools: Fortinet NSE · Network Security Fundamentals · Microsoft Security · Git · Threat Analysis
5. THE Security_Skills_Section SHALL reuse the existing tag-pill component styling already present on the Portfolio_Site and SHALL NOT introduce a new pill / chip class.

### Requirement 6 — About / Education Section

**User Story:** As a recruiter who sees "one module left," I want that framed as evidence of momentum — not an incompleteness — so I do not screen Ako out before reading the rest of his profile.

#### Acceptance Criteria

1. THE About_Section SHALL frame the "one module remaining" detail as a strategic position that reflects completing a BEngSc degree concurrently with running a live agency under real-world pressure, rather than as an incomplete qualification.
2. THE About_Section SHALL NOT use defensive, apologetic, or hedging phrasing about the remaining module, and THE copy SHALL position Ako as already operating at graduate level.
3. THE About_Section SHALL contain at most two paragraphs of body copy below the education heading.
4. THE About_Section SHALL render the following heading and two paragraphs verbatim:
   - H3: BEngSc in Digital Arts (Software Engineering, AI & Cybersecurity) — Wits University · Expected Completion: Semester 1, 2027
   - P1: I am completing my final academic requirement at Wits University — one module remaining in the first semester of 2027. My degree spans software engineering, artificial intelligence, and cybersecurity, reflecting a deliberately broad technical foundation built to operate across disciplines rather than within a single silo.
   - P2: What sets this final phase apart: I am completing it while co-running Adigital as a founding engineer, managing live deployments, client relationships, and architectural decisions in parallel with academic commitments. I do not arrive at a 2027 Graduate Programme as a theory-only candidate — I arrive having already operated under the simultaneous pressure of production systems and structured deadlines.

## Design Constraints

The following cross-cutting rules apply to every requirement above. They describe the design system boundaries that every implementation decision must respect.

### Colour

1. THE Portfolio_Site SHALL source every colour used by the new sections from existing CSS custom properties declared in `:root` of `styles.css` (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent-violet`, `--accent-cyan`).
2. THE Portfolio_Site SHALL NOT introduce any new hex colour values, named colours, or additional custom properties for colour.

### Typography

1. THE Portfolio_Site SHALL use `Space Grotesk` (weight 700) for all new heading elements in the added sections.
2. THE Portfolio_Site SHALL use `Inter` (weights 300–500) for all new body copy in the added sections.
3. THE Portfolio_Site SHALL restrict `Courier New` usage to terminal / log style accents, and SHALL NOT apply `Courier New` to headlines, body copy, certification cards, or project card copy.

### Glow Effects

1. THE Portfolio_Site SHALL express violet glow effects as `rgba(108, 99, 255, 0.X)` values with opacity matching the existing range already in use on the site (approximately 0.05–0.3).
2. THE Portfolio_Site SHALL NOT introduce neon-intensity glows beyond the opacity range already present in the design system.

### Card Styling (Glassmorphism)

1. THE Portfolio_Site SHALL style new cards (experience card, project cards, certification cards) using `background: var(--bg-secondary)`, `border: 1px solid rgba(108, 99, 255, 0.2)`, and `backdrop-filter: blur(10px)`, consistent with the existing glassmorphism card language.

### Animation

1. THE Portfolio_Site SHALL NOT introduce new `@keyframes` animations to implement this feature.
2. WHEN a new section requires scroll-reveal behaviour, THE Portfolio_Site SHALL reuse the existing `.fade-in` / `.reveal` class and the existing Intersection Observer set up in `script.js`.

### Layout

1. THE Portfolio_Site SHALL use CSS Grid for section-level layouts of the new sections and Flexbox for component-internal layouts (e.g., card headers, tag pill rows).
2. THE Portfolio_Site SHALL honour the existing responsive breakpoints at 768px and 480px and SHALL NOT introduce new breakpoints.

### Accessibility

1. THE Portfolio_Site SHALL provide an `id` attribute on every new `<section>` element introduced by this feature.
2. WHERE a new link's visible text alone is ambiguous as to its destination or purpose, THE Portfolio_Site SHALL provide an `aria-label` attribute clarifying the link's target.

### JavaScript

1. THE Portfolio_Site SHALL NOT add any new JavaScript file to implement this feature.
2. WHERE JavaScript logic is required (for example, to apply `.fade-in` / `.reveal` to newly added sections), THE Portfolio_Site SHALL add that logic to the existing `script.js`.

### Dependencies

1. THE Portfolio_Site SHALL NOT introduce any new runtime dependencies, build tools, package managers, or external libraries, and SHALL remain a static site of vanilla HTML5, CSS3, and JavaScript.
