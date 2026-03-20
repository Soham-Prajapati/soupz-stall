<!-- TYPEUI_SH_MANAGED_START -->
# Bento Design System Skill

## Mission
You are an expert design-system guideline author specializing in bento box (bento grid) layouts.
Create practical, implementation-ready guidance for modular, asymmetric grid layouts inspired by Japanese bento boxes.

## Brand Philosophy
Bento design uses asymmetric grids with varying cell sizes to create visually engaging, modular layouts. Popularized by Apple's product pages, Linear, and modern SaaS landing pages, bento grids present content in visually appealing blocks that guide the eye through information hierarchy. Each "cell" is a self-contained unit, but the grid creates a cohesive, organized whole.

## Core CSS Properties (CSS Grid is King)

### Basic Bento Grid
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, minmax(200px, auto));
  gap: 16px;
}

/* Cell spanning variants */
.bento-large {
  grid-column: span 2;
  grid-row: span 2;
}

.bento-wide {
  grid-column: span 2;
  grid-row: span 1;
}

.bento-tall {
  grid-column: span 1;
  grid-row: span 2;
}

.bento-small {
  grid-column: span 1;
  grid-row: span 1;
}
```

### Apple-Style Feature Grid
```css
.apple-bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 280px);
  gap: 20px;
}

/*
Layout visualization:
[  HERO  ][  HERO  ][ sm ][ sm ]
[  HERO  ][  HERO  ][ WIDE    ]
[ sm ][ sm ][ sm ][ sm ]
*/

.apple-bento .hero {
  grid-column: 1 / 3;
  grid-row: 1 / 3;
}
```

### Named Grid Areas (Cleaner)
```css
.bento-grid-named {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, 1fr);
  grid-template-areas:
    "hero  hero  feat1 feat2"
    "hero  hero  wide  wide"
    "sm1   sm2   sm3   sm4";
}

.bento-hero { grid-area: hero; }
.bento-feat1 { grid-area: feat1; }
.bento-feat2 { grid-area: feat2; }
.bento-wide { grid-area: wide; }
```

## Style Foundations
- Visual style: modular, organized, editorial, premium, Apple-inspired
- Layout: CSS Grid with asymmetric cell sizes
- Gap: 16px (compact) | 20px (standard) | 24px (spacious)
- Border-radius: 20px - 28px (Apple-style rounded)
- Typography: clean hierarchy within each cell
- Spacing scale: 4/8/12/16/24/32/48

## Grid Configuration Patterns

### 2x2 Simple
```css
.bento-2x2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 16px;
}
```

### 6-Cell Dashboard
```css
.bento-dashboard {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 24px;
  grid-template-areas:
    "main    main    side"
    "small1  small2  side";
}
```

### 8-Cell Feature Showcase
```css
.bento-features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, minmax(200px, auto));
  gap: 16px;
  grid-template-areas:
    "hero hero feat1 feat2"
    "feat3 feat4 feat5 feat5";
}
```

### Masonry-Like (Variable Heights)
```css
.bento-masonry {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 100px;
  gap: 16px;
}

/* Span multiple rows for taller items */
.bento-masonry .tall { grid-row: span 2; }
.bento-masonry .tall-xl { grid-row: span 3; }
```

## Design Tokens (CSS Custom Properties)
```css
:root {
  /* Grid Configuration */
  --bento-gap: 16px;
  --bento-gap-lg: 24px;
  --bento-min-cell: 200px;
  --bento-radius: 24px;

  /* Card Styling */
  --bento-card-bg: var(--surface);
  --bento-card-padding: 24px;
  --bento-card-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);

  /* Aspect Ratios */
  --bento-ratio-square: 1 / 1;
  --bento-ratio-wide: 2 / 1;
  --bento-ratio-tall: 1 / 2;
}
```

## Card Sizing Ratios
```css
.bento-card-square { aspect-ratio: 1 / 1; }
.bento-card-wide { aspect-ratio: 2 / 1; }
.bento-card-tall { aspect-ratio: 1 / 2; }
.bento-card-golden { aspect-ratio: 1.618 / 1; }
```

## Component Examples

### Bento Card (Apple-Style)
```css
.bento-card {
  position: relative;
  border-radius: var(--bento-radius);
  background: var(--bento-card-bg);
  overflow: hidden;
  box-shadow: var(--bento-card-shadow);
}

.bento-card-content {
  padding: var(--bento-card-padding);
  position: relative;
  z-index: 1;
}

/* Image card with gradient overlay */
.bento-card-image {
  background-size: cover;
  background-position: center;
}

.bento-card-image::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 40%,
    rgba(0, 0, 0, 0.7) 100%
  );
}

.bento-card-image .bento-card-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  color: white;
}
```

### Bento Grid Container
```css
.bento-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--bento-gap);
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--bento-gap);
}

/* Feature card spanning 2x2 */
.bento-hero-card {
  grid-column: span 2;
  grid-row: span 2;
  min-height: 400px;
}

/* Wide card spanning 2 columns */
.bento-wide-card {
  grid-column: span 2;
}

/* Tall card spanning 2 rows */
.bento-tall-card {
  grid-row: span 2;
}
```

## Responsive Behavior

```css
.bento-grid {
  display: grid;
  gap: var(--bento-gap);

  /* Mobile: Stack */
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .bento-grid {
    /* Tablet: 2 columns */
    grid-template-columns: repeat(2, 1fr);
  }

  .bento-wide { grid-column: span 2; }
}

@media (min-width: 1024px) {
  .bento-grid {
    /* Desktop: 4 columns */
    grid-template-columns: repeat(4, 1fr);
  }

  .bento-large {
    grid-column: span 2;
    grid-row: span 2;
  }
}
```

## Animation Patterns

### Staggered Fade-In
```css
.bento-card {
  opacity: 0;
  transform: translateY(30px);
  animation: bentoReveal 0.6s ease-out forwards;
}

.bento-card:nth-child(1) { animation-delay: 0ms; }
.bento-card:nth-child(2) { animation-delay: 100ms; }
.bento-card:nth-child(3) { animation-delay: 200ms; }
.bento-card:nth-child(4) { animation-delay: 300ms; }
.bento-card:nth-child(5) { animation-delay: 400ms; }
.bento-card:nth-child(6) { animation-delay: 500ms; }

@keyframes bentoReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bento-card {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

### Hover Lift
```css
.bento-card-interactive {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.bento-card-interactive:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.15),
    0 10px 20px rgba(0, 0, 0, 0.1);
}
```

### Scale Pop (Framer Motion Pattern)
```javascript
// For React with Framer Motion
const bentoVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  })
};
```

## Motion & Animation Tokens
```css
:root {
  --bento-duration-reveal: 600ms;
  --bento-duration-hover: 300ms;
  --bento-stagger: 100ms;
  --bento-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

## Accessibility Requirements
- WCAG 2.2 AA compliance
- Logical content order in HTML (not just visual)
- Keyboard navigable cards (if interactive)
- Focus states clearly visible
- Touch targets: minimum 44x44px for interactive elements
- Reduced motion: disable stagger animations
- Screen reader: meaningful headings and link text

```css
/* Focus states */
.bento-card-interactive:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

/* Keyboard focus within card */
.bento-card a:focus-visible,
.bento-card button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

## Writing Tone
clean, organized, premium, editorial, curated

## Rules: Do
- Use CSS Grid with explicit column/row spans
- Apply consistent gap spacing throughout
- Use generous border-radius (20-28px) for Apple aesthetic
- Size hero/feature cards at 2x2 for visual weight
- Apply staggered reveal animations for delight
- Plan responsive breakpoints (mobile = stack)
- Ensure content fits within cells (no overflow)
- Use gradient overlays on image cards for text legibility

## Rules: Don't
- Avoid inconsistent gap sizes
- Avoid too many small cells (creates visual noise)
- Avoid grids with more than 4-5 distinct cell sizes
- Avoid image-only cards without text hierarchy
- Avoid forgetting responsive behavior
- Avoid overflow from cells
- Avoid using bento for sequential/list content

## Anti-Patterns (Common Mistakes)
```css
/* BAD: Inconsistent gaps */
.bento-grid {
  gap: 16px;
}
.bento-card:first-child {
  margin-right: 24px;  /* Don't mix gaps and margins */
}

/* BAD: Too many cell sizes */
/* Using 6+ different span configurations = visual chaos */

/* BAD: No responsive handling */
.bento-grid {
  grid-template-columns: repeat(4, 1fr);  /* Breaks on mobile */
}

/* BAD: Content overflow */
.bento-card {
  height: 200px;  /* Fixed height with variable content = overflow */
}
```

## When to Use Bento Layouts
- Product feature showcases (Apple-style)
- Portfolio/case study grids
- Dashboard widgets
- Landing page sections
- Image galleries
- Feature comparison grids
- Blog/article collections
- App screenshots

## When NOT to Use Bento Layouts
- Sequential content (use lists/cards)
- Highly data-dense tables
- Text-heavy documentation
- E-commerce product listings (prefer consistent grids)
- Mobile-first apps (complex grids don't translate)

## Quality Gates
- Grid uses CSS Grid (not flexbox hacks)
- Gap is consistent across all cells
- Responsive breakpoints defined
- Hero/large cards have visual prominence
- Stagger animation has reduced-motion fallback
- Content fits within cells
- Interactive cards have focus states

## QA Checklist
- [ ] CSS Grid with explicit column/row configuration
- [ ] Consistent gap spacing
- [ ] Border-radius consistent (20-28px)
- [ ] Responsive: 4 cols desktop, 2 cols tablet, 1 col mobile
- [ ] Hero cards span 2x2 or 2x1
- [ ] Stagger animation on reveal
- [ ] Reduced motion fallback
- [ ] Focus states on interactive cards
- [ ] Content doesn't overflow cells
- [ ] Images have gradient overlays for text legibility
- [ ] Touch targets meet 44px minimum

<!-- TYPEUI_SH_MANAGED_END -->
