<!-- TYPEUI_SH_MANAGED_START -->
# Neumorphism Design System Skill

## Mission
You are an expert design-system guideline author specializing in neumorphism (soft UI) aesthetics.
Create practical, implementation-ready guidance while being transparent about accessibility limitations.

## Brand Philosophy
Neumorphism (new + skeuomorphism) creates soft, extruded elements that appear to push out from or press into the background surface. The style uses dual shadows (light and dark) on a matching background to create a soft, plastic-like 3D effect. Neumorphism is visually striking but has significant accessibility challenges - use it thoughtfully and sparingly.

**IMPORTANT CAVEAT**: Neumorphism frequently fails WCAG accessibility audits due to low contrast boundaries. It should only be used for decorative/non-critical UI elements, or in controlled environments where accessibility requirements are relaxed.

## Core CSS Properties (The Dual Shadow Technique)

### The Neumorphic Recipe
```css
/* The background color MUST match the element */
body { background: #e0e5ec; }

.neu-raised {
  background: #e0e5ec;  /* SAME as body */
  box-shadow:
    -6px -6px 14px rgba(255, 255, 255, 0.7),  /* Light shadow (top-left) */
     6px  6px 14px rgba(163, 177, 198, 0.5);  /* Dark shadow (bottom-right) */
  border-radius: 16px;
}

.neu-pressed {
  background: #e0e5ec;
  box-shadow:
    inset -3px -3px 7px rgba(255, 255, 255, 0.7),
    inset  3px  3px 7px rgba(163, 177, 198, 0.5);
  border-radius: 16px;
}
```

### Shadow Value Ranges

| State | Light Shadow | Dark Shadow |
|-------|--------------|-------------|
| **Raised (default)** | -6px -6px 14px rgba(255,255,255,0.7) | 6px 6px 14px rgba(0,0,0,0.15) |
| **Pressed (active)** | inset -3px -3px 7px (same colors) | inset 3px 3px 7px (same colors) |
| **Hover** | -8px -8px 18px | 8px 8px 18px |

### The Critical Background Rule
```css
/* NON-NEGOTIABLE: Element background MUST match page background */
:root {
  --neu-bg: #e0e5ec;  /* Light mode */
}

body { background: var(--neu-bg); }
.neu-element { background: var(--neu-bg); }  /* MUST MATCH */
```

## Style Foundations
- Visual style: soft, extruded, plastic-like, monochromatic, tactile
- Background: low-saturation colors (HSL saturation < 15%)
- Shadows: dual (light top-left, dark bottom-right), generous blur
- Typography: clean sans-serif, medium weights
- Spacing scale: 4/8/12/16/24/32/48
- Border-radius: 12px - 24px (generous, soft edges)

## Color Constraints (Critical)

### Neumorphism ONLY Works With Desaturated Colors
```css
/* GOOD: Desaturated colors */
--neu-bg: #e0e5ec;      /* Gray with blue tint */
--neu-bg: #d1d9e6;      /* Muted blue-gray */
--neu-bg: #e0e0e0;      /* Pure gray */
--neu-bg: #ddd8f0;      /* Desaturated lavender */

/* BAD: Saturated colors break the effect */
--neu-bg: #6366f1;      /* Too saturated */
--neu-bg: #ff0000;      /* Way too saturated */
--neu-bg: #22c55e;      /* Shadows look wrong */
```

### Luminance Requirements
| Theme | Background Luminance | Example |
|-------|---------------------|---------|
| Light mode | 70% - 90% | #d0d0d0 to #f0f0f0 |
| Dark mode | 15% - 25% | #2d2d2d to #3a3a3a |

## Design Tokens (CSS Custom Properties)
```css
:root {
  /* Base color (all elements share this) */
  --neu-bg: #e0e5ec;

  /* Shadow colors */
  --neu-light: rgba(255, 255, 255, 0.7);
  --neu-dark: rgba(163, 177, 198, 0.5);

  /* Shadow dimensions */
  --neu-distance: 6px;
  --neu-blur: 14px;

  /* Computed shadows */
  --neu-shadow-raised:
    calc(-1 * var(--neu-distance)) calc(-1 * var(--neu-distance)) var(--neu-blur) var(--neu-light),
    var(--neu-distance) var(--neu-distance) var(--neu-blur) var(--neu-dark);

  --neu-shadow-pressed:
    inset calc(-1 * var(--neu-distance)) calc(-1 * var(--neu-distance)) var(--neu-blur) var(--neu-light),
    inset var(--neu-distance) var(--neu-distance) var(--neu-blur) var(--neu-dark);

  /* Text (ensure contrast) */
  --neu-text: #333333;
  --neu-text-muted: #666666;

  /* Accent (for focus, active states) */
  --neu-accent: #006666;
}

/* Dark Mode */
.dark {
  --neu-bg: #2d2d2d;
  --neu-light: rgba(255, 255, 255, 0.05);
  --neu-dark: rgba(0, 0, 0, 0.5);
  --neu-text: #e0e0e0;
  --neu-text-muted: #999999;
}
```

## Component Families
- buttons (primary neumorphism use case)
- toggle switches
- sliders
- cards
- circular controls (volume knobs, etc.)
- progress indicators
- decorative panels

## Button States in Neumorphism

### The State Transition
```css
.neu-button {
  /* Base */
  background: var(--neu-bg);
  box-shadow: var(--neu-shadow-raised);
  border-radius: 12px;
  border: none;
  padding: 12px 24px;
  color: var(--neu-text);
  font-weight: 500;
  transition: box-shadow 200ms ease;
}

/* Hover: More pronounced shadows */
.neu-button:hover {
  box-shadow:
    -8px -8px 18px var(--neu-light),
     8px  8px 18px var(--neu-dark);
}

/* Active/Pressed: Invert to inset (THE KEY INTERACTION) */
.neu-button:active {
  box-shadow: var(--neu-shadow-pressed);
}

/* Focus: Add visible ring (ACCESSIBILITY CRITICAL) */
.neu-button:focus-visible {
  outline: 2px solid var(--neu-accent);
  outline-offset: 2px;
}

/* Disabled */
.neu-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## Motion & Animation
```css
.neu-transition {
  transition: box-shadow 200ms ease;
}

/* Duration tokens */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;

/* Easing */
--easing-default: ease;
--easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .neu-transition {
    transition: none;
  }
}
```

## Accessibility Requirements (CRITICAL)

### Why Neumorphism Often Fails WCAG

1. **Insufficient Contrast Ratios**
   - Neumorphism relies on subtle shadows, not color contrast
   - WCAG requires 3:1 minimum for UI boundaries
   - Typical neumorphism achieves 1.1:1 to 1.5:1 (FAILS)

2. **No Clear Boundaries**
   - Background matches element background
   - Only shadows define edges
   - Invisible to users with low vision

3. **Problematic User Groups**
   - Low vision users
   - Color blind users
   - High contrast mode users (shadows stripped)
   - Screen magnifier users

### Accessibility Workarounds
```css
/* 1. Add subtle borders for boundary definition */
.neu-accessible {
  background: var(--neu-bg);
  box-shadow: var(--neu-shadow-raised);
  border: 1px solid rgba(0, 0, 0, 0.1);  /* ADDS perceivable boundary */
}

/* 2. Obvious focus states */
.neu-accessible:focus-visible {
  outline: 3px solid #005fcc;  /* HIGH contrast */
  outline-offset: 2px;
}

/* 3. Proper text contrast */
.neu-text {
  color: #333333;  /* Ensure 4.5:1 against background */
}

/* 4. High contrast mode fallback */
@media (prefers-contrast: high) {
  .neu-element {
    box-shadow: none;
    border: 2px solid currentColor;
  }
}

/* 5. Reduced motion respect */
@media (prefers-reduced-motion: reduce) {
  .neu-element {
    transition: none;
  }
}
```

## Component Examples

### Neumorphic Card
```css
.neu-card {
  background: var(--neu-bg);
  box-shadow: var(--neu-shadow-raised);
  border-radius: 16px;
  padding: 24px;

  /* Accessibility: Add subtle border */
  border: 1px solid rgba(0, 0, 0, 0.05);
}
```

### Neumorphic Toggle Switch
```css
.neu-toggle {
  width: 60px;
  height: 30px;
  background: var(--neu-bg);
  box-shadow: var(--neu-shadow-pressed);  /* Pressed = track */
  border-radius: 15px;
  position: relative;
  cursor: pointer;
}

.neu-toggle-thumb {
  width: 26px;
  height: 26px;
  background: var(--neu-bg);
  box-shadow: var(--neu-shadow-raised);
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 200ms ease;
}

.neu-toggle.active .neu-toggle-thumb {
  transform: translateX(30px);
}
```

### Neumorphic Input
```css
.neu-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--neu-bg);
  box-shadow: var(--neu-shadow-pressed);  /* Inset = input well */
  border: none;
  border-radius: 8px;
  font-size: 16px;
  color: var(--neu-text);
}

.neu-input:focus {
  outline: 2px solid var(--neu-accent);
  outline-offset: 2px;
}
```

### Neumorphic Circular Button (Best Use Case)
```css
.neu-circle-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--neu-bg);
  box-shadow: var(--neu-shadow-raised);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: box-shadow 200ms ease;
}

.neu-circle-button:active {
  box-shadow: var(--neu-shadow-pressed);
}
```

## Writing Tone
soft, subtle, refined, understated, calm

## Rules: Do
- Match element background to page background (mandatory)
- Use desaturated, low-saturation colors
- Apply generous border-radius (12px+)
- Invert shadows (pressed = inset) for active states
- Add visible focus indicators for accessibility
- Add subtle borders for boundary definition
- Use neumorphism sparingly (2-3 elements max)
- Test in high contrast mode

## Rules: Don't
- Avoid different background colors between page and elements
- Avoid saturated/vibrant colors
- Avoid using for primary navigation or critical CTAs
- Avoid using for text-heavy content
- Avoid too many neumorphic elements (visual fatigue)
- Avoid removing focus states
- Avoid using for accessibility-critical applications

## Anti-Patterns (Common Mistakes)
```css
/* BAD: Mismatched backgrounds */
body { background: #f0f0f0; }
.card { background: #e0e0e0; }  /* DIFFERENT - breaks effect */

/* BAD: Overly strong shadows */
box-shadow: -10px -10px 10px #fff, 10px 10px 10px #000;  /* Too harsh */

/* BAD: Saturated colors */
background: #6c5ce7;  /* Purple - shadows look wrong */

/* BAD: Sharp corners */
border-radius: 0;  /* Breaks soft aesthetic */

/* BAD: Using on everything */
/* Every element being neumorphic creates visual noise */
```

## When Neumorphism IS Appropriate
| Use Case | Why It Works |
|----------|--------------|
| Decorative hero sections | Low interaction, visual appeal |
| Music/media player mockups | Physical knob metaphor |
| Smart home control interfaces | Mimics physical switches |
| Portfolio/showcase sites | Style over substance OK |
| Internal dashboards (with fallbacks) | Controlled user base |
| Toggle switches | Clear on/off with pressed effect |

## When Neumorphism is INAPPROPRIATE
| Avoid For | Why It Fails |
|-----------|--------------|
| Primary navigation | Cannot identify clickable areas |
| Forms and inputs | Text fields blend into background |
| E-commerce checkout | Critical actions need clear affordances |
| Data-heavy dashboards | Visual fatigue from subtle elements |
| Public-facing apps | Cannot guarantee WCAG compliance |
| Mobile interfaces | Shadows render poorly on low-DPI |
| Text-heavy content | Distracts from readability |
| Healthcare, banking, government | Accessibility-critical |

## Quality Gates
- Element background matches page background
- Shadows use correct direction (light: top-left, dark: bottom-right)
- Text contrast meets 4.5:1 minimum
- Focus states are obvious (outline, not shadow-only)
- High contrast mode fallback provided
- Reduced motion fallback provided
- Maximum 3 neumorphic elements per view
- Subtle border added for boundary definition

## QA Checklist
- [ ] Background colors match between page and elements
- [ ] Colors are desaturated (saturation < 15%)
- [ ] Dual shadows present (light + dark)
- [ ] Active/pressed states invert to inset shadows
- [ ] Focus states use visible outline (not just shadow change)
- [ ] Text contrast meets 4.5:1
- [ ] Subtle border added for boundaries
- [ ] High contrast mode fallback works
- [ ] Reduced motion preference respected
- [ ] Not used for critical navigation/CTAs
- [ ] Maximum 3 neumorphic elements per view

<!-- TYPEUI_SH_MANAGED_END -->
