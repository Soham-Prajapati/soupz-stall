<!-- TYPEUI_SH_MANAGED_START -->
# Neobrutalism Design System Skill

## Mission
You are an expert design-system guideline author specializing in neobrutalism (neo-brutalist) aesthetics.
Create practical, implementation-ready guidance that produces bold, raw, high-contrast UIs with intentional roughness.

## Brand Philosophy
Neobrutalism is a modern evolution of brutalist web design that combines bold, raw aesthetics with modern usability. Unlike chaotic raw brutalism, neobrutalism is intentionally crafted - using thick borders, harsh shadows with zero blur, and saturated "ugly" colors to create memorable, high-energy interfaces. The style signals creativity, confidence, and rejection of sterile corporate design. Popularized by Figma, Gumroad, and indie SaaS products.

## Core CSS Properties (The Signature Look)

### The Neobrutalist Recipe
```css
.neo-element {
  /* 1. Bold solid border (non-negotiable) */
  border: 2px solid #000;

  /* 2. Harsh shadow with ZERO blur (the signature) */
  box-shadow: 4px 4px 0 #000;

  /* 3. Saturated background color */
  background-color: #ffdc00;

  /* 4. Sharp or minimal radius */
  border-radius: 0; /* or max 4px */
}
```

### Recommended Values

| Property | Standard | Emphasis |
|----------|----------|----------|
| `border-width` | 2px | 3px - 4px |
| `box-shadow x/y` | 4px 4px | 6px 6px - 8px 8px |
| `box-shadow blur` | 0 (always) | 0 (always) |
| `border-radius` | 0 | 2px - 4px max |
| `border-color` | #000 (black) | currentColor |

## Style Foundations
- Visual style: bold, raw, high-contrast, intentional, memorable, anti-corporate
- Border: 2-4px solid black, always consistent width across system
- Shadow: harsh (4-8px offset, zero blur), matches border color
- Colors: saturated primaries (yellow, pink, blue, lime), black, white, cream
- Typography: heavy weights (700-900), geometric sans-serif or monospace
- Spacing scale: 4/8/12/16/24/32/48
- Border-radius: 0 (preferred) or max 4px

## Color Palette (Neobrutalist Colors)
```css
:root {
  /* Primary Accents (saturated, bold) */
  --neo-yellow: #ffdc00;      /* Most iconic */
  --neo-pink: #ff6b9d;
  --neo-magenta: #ec4899;
  --neo-blue: #3b82f6;
  --neo-cyan: #06b6d4;
  --neo-lime: #a3e635;
  --neo-orange: #f97316;
  --neo-red: #ef4444;

  /* Neutrals */
  --neo-black: #000000;
  --neo-white: #ffffff;
  --neo-cream: #fef3c7;       /* Warm background */
  --neo-gray: #e5e5e5;

  /* Semantic */
  --neo-border: var(--neo-black);
  --neo-shadow: var(--neo-black);
  --neo-bg: var(--neo-cream);
  --neo-text: var(--neo-black);
}

.dark {
  --neo-border: var(--neo-white);
  --neo-shadow: var(--neo-white);
  --neo-bg: #1a1a1a;
  --neo-text: var(--neo-white);
}
```

## Design Tokens (CSS Custom Properties)
```css
:root {
  /* Border System */
  --neo-border-width: 2px;
  --neo-border-color: #000;
  --neo-border: var(--neo-border-width) solid var(--neo-border-color);

  /* Shadow System */
  --neo-shadow-x: 4px;
  --neo-shadow-y: 4px;
  --neo-shadow-blur: 0;
  --neo-shadow-color: #000;
  --neo-shadow: var(--neo-shadow-x) var(--neo-shadow-y) var(--neo-shadow-blur) var(--neo-shadow-color);

  /* Reduced shadow for hover */
  --neo-shadow-hover: 2px 2px 0 var(--neo-shadow-color);

  /* Typography */
  --font-primary: 'Inter', 'DM Sans', system-ui, sans-serif;
  --font-display: 'Space Grotesk', 'Archivo Black', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-weight-bold: 700;
  --font-weight-black: 900;
}
```

## Typography
```css
/* Neobrutalist typography is BOLD */
h1, .neo-heading-xl {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 48px;
  line-height: 1.1;
  letter-spacing: -0.02em;
  text-transform: uppercase; /* Common but optional */
}

h2, .neo-heading-lg {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 32px;
  line-height: 1.2;
}

.neo-body {
  font-family: var(--font-primary);
  font-weight: 400;
  font-size: 16px;
  line-height: 1.5;
}

.neo-mono {
  font-family: var(--font-mono);
  font-weight: 500;
}
```

## Component Families
- buttons (the star of neobrutalism)
- inputs
- cards
- checkboxes/radios
- tags/badges
- navigation
- tabs
- modals
- alerts
- forms

## Hover State Patterns

### Pattern 1: Press Down (Most Common)
```css
.neo-button {
  border: var(--neo-border);
  box-shadow: var(--neo-shadow);
  transition: transform 100ms ease, box-shadow 100ms ease;
}

.neo-button:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 var(--neo-shadow-color);
}

.neo-button:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 var(--neo-shadow-color);
}
```

### Pattern 2: Lift Up
```css
.neo-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--neo-shadow-color);
}
```

### Pattern 3: Color Invert
```css
.neo-button-invert {
  background: var(--neo-white);
  color: var(--neo-black);
}

.neo-button-invert:hover {
  background: var(--neo-black);
  color: var(--neo-white);
}
```

## Motion & Animation
```css
/* Neobrutalist motion is SNAPPY */
.neo-transition {
  transition:
    transform 100ms ease,
    box-shadow 100ms ease,
    background-color 100ms ease;
}

/* Duration tokens (keep it fast) */
--duration-instant: 50ms;
--duration-fast: 100ms;
--duration-normal: 150ms;

/* Easing */
--easing-default: ease;
--easing-snap: cubic-bezier(0.4, 0, 0.2, 1);

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .neo-transition {
    transition: none;
  }
}
```

## Component Examples

### Neobrutalist Button
```css
.neo-button {
  /* Base */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  min-height: 44px;

  /* Typography */
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  /* Colors */
  background-color: var(--neo-yellow);
  color: var(--neo-black);

  /* The signature look */
  border: 2px solid var(--neo-black);
  box-shadow: 4px 4px 0 var(--neo-black);
  border-radius: 0;

  /* Interaction */
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;
}

.neo-button:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 var(--neo-black);
}

.neo-button:active {
  transform: translate(4px, 4px);
  box-shadow: 0 0 0 var(--neo-black);
}

.neo-button:focus-visible {
  outline: 3px solid var(--neo-blue);
  outline-offset: 2px;
}

.neo-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: var(--neo-shadow);
}

/* Variant: Outlined */
.neo-button--outline {
  background-color: transparent;
}

.neo-button--outline:hover {
  background-color: var(--neo-black);
  color: var(--neo-white);
}
```

### Neobrutalist Card
```css
.neo-card {
  padding: 24px;
  background-color: var(--neo-white);
  border: 2px solid var(--neo-black);
  box-shadow: 6px 6px 0 var(--neo-black);
}

/* Card with colored header */
.neo-card__header {
  margin: -24px -24px 16px -24px;
  padding: 16px 24px;
  background-color: var(--neo-yellow);
  border-bottom: 2px solid var(--neo-black);
}
```

### Neobrutalist Input
```css
.neo-input {
  width: 100%;
  padding: 12px 16px;
  font-family: var(--font-primary);
  font-size: 16px;

  background-color: var(--neo-white);
  color: var(--neo-black);

  border: 2px solid var(--neo-black);
  box-shadow: 4px 4px 0 var(--neo-black);

  transition: box-shadow 100ms ease, transform 100ms ease;
}

.neo-input:focus {
  outline: none;
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--neo-black);
}
```

### Neobrutalist Checkbox
```css
.neo-checkbox {
  appearance: none;
  width: 24px;
  height: 24px;

  background-color: var(--neo-white);
  border: 2px solid var(--neo-black);
  box-shadow: 3px 3px 0 var(--neo-black);

  cursor: pointer;
  transition: all 100ms ease;
}

.neo-checkbox:checked {
  background-color: var(--neo-yellow);
}

.neo-checkbox:checked::after {
  content: '✓';
  display: block;
  text-align: center;
  font-weight: 900;
  line-height: 20px;
}

.neo-checkbox:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--neo-black);
}
```

### Neobrutalist Tag
```css
.neo-tag {
  display: inline-block;
  padding: 4px 12px;

  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;

  background-color: var(--neo-cyan);
  color: var(--neo-black);

  border: 2px solid var(--neo-black);
  box-shadow: 2px 2px 0 var(--neo-black);
}
```

## Accessibility Requirements
- WCAG 2.2 AA: 4.5:1 text contrast, 3:1 UI contrast
- High contrast actually helps - use black text on bright colors
- Focus states: 3px solid outline, offset 2px, high contrast color
- Touch targets: minimum 44x44px
- Keyboard navigation: all interactive elements focusable
- Reduced motion: disable transform animations

### Accessibility Patterns
```css
/* Always use black text on bright neobrutalist colors */
.neo-button {
  background: #ffdc00;  /* Yellow */
  color: #000;          /* Black - 14.5:1 contrast ratio */
}

/* NEVER white text on yellow */
.neo-button-bad {
  background: #ffdc00;
  color: #fff;          /* FAILS - 1.07:1 ratio */
}

/* Focus must be obvious */
.neo-element:focus-visible {
  outline: 3px solid var(--neo-blue);
  outline-offset: 2px;
}
```

## Writing Tone
bold, confident, direct, energetic, unapologetic

## Rules: Do
- Use consistent border width (2px OR 3px) across entire system
- Use zero-blur shadows with equal x/y offset
- Use saturated, bold colors (yellow, pink, blue, lime)
- Use black for borders and shadows (or white in dark mode)
- Use heavy font weights (700-900) for headings
- Keep hover animations snappy (100-150ms)
- Apply neobrutalism to key interactive elements, not everything
- Maintain clear typography hierarchy

## Rules: Don't
- Avoid mixing different border widths in same design
- Avoid rounded corners (keep 0-4px max)
- Avoid soft/blurred shadows
- Avoid gradients (solid fills only)
- Avoid pastel colors (neobrutalism uses saturated colors)
- Avoid using glass effects or transparency
- Avoid too many colors (limit to 2-3 accents per view)
- Avoid applying to every element (use restraint)

## Anti-Patterns (Common Mistakes)
```css
/* BAD: Inconsistent border widths */
.card { border: 2px solid #000; }
.button { border: 3px solid #000; }  /* Different! */
.input { border: 1px solid #000; }   /* Different! */

/* BAD: Rounded corners break the aesthetic */
.neo-button {
  border-radius: 12px;  /* Too soft */
}

/* BAD: Soft shadows are anti-neobrutalist */
.neo-card {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);  /* NO blur! */
}

/* BAD: Gradients */
.neo-button {
  background: linear-gradient(135deg, #ffdc00, #ff6b9d);  /* NO! */
}

/* BAD: Low contrast text */
.neo-tag {
  background: #ffdc00;
  color: #ffffff;  /* FAILS accessibility */
}
```

## When to Use Neobrutalism
- Creative portfolios
- Design tool landing pages (Figma-style)
- Indie products and SaaS
- Editorial/magazine sites
- Developer tools
- Youth-focused brands (Gen Z resonates)
- Event/conference sites
- Music/entertainment

## When NOT to Use Neobrutalism
- Enterprise B2B software
- Healthcare/medical applications
- Financial services
- Legal services
- Accessibility-critical apps
- Long-form reading content
- Luxury brands
- Senior-focused products

## Responsive Considerations
```css
/* Scale shadow on smaller screens */
@media (max-width: 640px) {
  :root {
    --neo-shadow-x: 3px;
    --neo-shadow-y: 3px;
  }
}
```

## Quality Gates
- Border width consistent across all components
- All shadows use zero blur
- Text contrast meets WCAG AA (4.5:1)
- Focus states are obvious and high-contrast
- Touch targets meet 44px minimum
- Reduced motion preference respected
- Maximum 2-3 accent colors per view

## QA Checklist
- [ ] Border width is consistent (all 2px OR all 3px)
- [ ] All shadows have zero blur
- [ ] Background colors are saturated (not pastel)
- [ ] Text contrast meets 4.5:1 minimum
- [ ] Hover states use press-down pattern
- [ ] Focus states are clearly visible
- [ ] Touch targets are 44px minimum
- [ ] Keyboard navigation works
- [ ] Reduced motion fallback provided
- [ ] No gradients used
- [ ] No rounded corners > 4px

<!-- TYPEUI_SH_MANAGED_END -->
