# Project Structure

## File Organization

```
/
├── index.html          # Main HTML file with all content sections
├── styles.css          # All CSS styles and animations
├── script.js           # All JavaScript functionality
├── favicon.svg         # Site favicon
├── README.md           # Project documentation
├── .git/               # Git repository
├── .kiro/              # Kiro AI assistant configuration
│   └── steering/       # AI steering rules
└── .vscode/            # VS Code settings
```

## HTML Structure (index.html)

Sections are organized in semantic order:

1. **Loading Screen** - Initial page load animation
2. **Navigation** - Fixed navbar with mobile toggle
3. **Hero Section** - Canvas particle animation + main heading
4. **About Section** - Personal introduction + principles grid
5. **Skills DNA Section** - Technology skills strip
6. **Projects Section** - Project cards grid
7. **Mindset Section** - Rotating quotes
8. **Personal Section** - Interests cards with hover overlays
9. **In Motion Section** - Current learning/building status
10. **Purpose Section** - SVG circuit background + mission statement
11. **Contact Section** - Form + social links
12. **Footer** - System log animation + easter egg

## CSS Architecture (styles.css)

Organized by component:

1. **CSS Variables** - Color scheme and reusable values
2. **Reset & Base** - Global styles
3. **Loading Screen**
4. **Navigation** - Desktop and mobile styles
5. **Hero Section** - Particle canvas + typography
6. **Section Styles** - Shared section patterns
7. **Component-specific styles** - Each section's unique styles
8. **Animations** - Keyframe definitions
9. **Responsive Design** - Media queries (768px, 480px breakpoints)

## JavaScript Organization (script.js)

Modular sections with clear separation:

1. **Loading Screen** - Fade out animation
2. **Particle Canvas** - Class-based particle system
3. **Navigation** - Scroll effects + mobile menu
4. **Scroll Reveal** - Intersection Observer setup
5. **Rotating Quotes** - Timed quote rotation
6. **Contact Form** - Form submission handler
7. **Easter Eggs** - Lock icon, Konami code, console messages
8. **Smooth Scroll** - Enhanced anchor navigation
9. **Cursor Glow** - Desktop-only cursor effect
10. **Performance** - Debounced scroll events

## Naming Conventions

- **CSS Classes**: kebab-case (e.g., `hero-content`, `section-title`)
- **IDs**: kebab-case (e.g., `particle-canvas`, `loading-screen`)
- **JavaScript Variables**: camelCase (e.g., `particleCount`, `currentQuoteIndex`)
- **CSS Variables**: kebab-case with `--` prefix (e.g., `--accent-violet`)

## Color Scheme

Defined in `:root` CSS variables:
- `--bg-primary`: #0E0E10 (main background)
- `--bg-secondary`: #1A1A1D (section backgrounds)
- `--text-primary`: #E0E0E0 (main text)
- `--text-secondary`: #A0A0A0 (secondary text)
- `--accent-violet`: #6C63FF (primary accent)
- `--accent-cyan`: #70E0FF (secondary accent)
