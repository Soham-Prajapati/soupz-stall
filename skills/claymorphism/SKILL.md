<!-- TYPEUI_SH_MANAGED_START -->
# Claymorphism Design System Skill

## Mission
You are an expert design-system guideline author specializing in claymorphism aesthetics.
Create practical, implementation-ready guidance for soft, puffy, 3D clay-like UI elements.

## Brand Philosophy
Claymorphism creates soft, rounded, 3D-like "puffy" elements that mimic malleable, colorful clay. Evolved from neumorphism around 2021-2022, it adds more personality and playfulness through vibrant colors and inflated shapes. The style evokes tactile, friendly, approachable interfaces often seen in children's apps, creative tools, and playful consumer products.

## Core CSS Properties (The Puffy Effect)

### The Claymorphism Recipe
```css
.clay-element {
  /* 1. Very large border-radius (the "puffy" shape) */
  border-radius: 32px;

  /* 2. Soft gradient background */
  background: linear-gradient(145deg, #ffb3ba, #ff8fa3);

  /* 3. Multi-layer shadows for 3D effect */
  box-shadow:
    /* Main drop shadow */
    8px 8px 16px rgba(0, 0, 0, 0.2),
    /* Secondary softer shadow */
    4px 4px 8px rgba(0, 0, 0, 0.1),
    /* Inner bottom shadow (depth) */
    inset 0px -8px 16px rgba(0, 0, 0, 0.1),
    /* Inner top highlight (inflation) */
    inset 0px 8px 16px rgba(255, 255, 255, 0.6);
}
```

### Shadow Breakdown

| Shadow Layer | Purpose | Typical Values |
|--------------|---------|----------------|
| Outer drop shadow | Ground the element | 8px 8px 16px rgba(0,0,0,0.2) |
| Secondary outer | Softer ambient | 4px 4px 8px rgba(0,0,0,0.1) |
| Inner top highlight | Inflation effect | inset 0 8px 16px rgba(255,255,255,0.6) |
| Inner bottom shadow | Depth/weight | inset 0 -8px 16px rgba(0,0,0,0.1) |

### Background Gradient Pattern
```css
.clay-card {
  /* Subtle gradient adds dimension */
  background: linear-gradient(
    145deg,
    hsl(350, 100%, 85%) 0%,    /* Lighter top-left */
    hsl(350, 80%, 75%) 100%    /* Darker bottom-right */
  );
}
```

## Style Foundations
- Visual style: soft, puffy, 3D, playful, tactile, friendly
- Border-radius: 24px (minimum) | 32px (standard) | 48px+ (very puffy)
- Shadows: multi-layer (outer + inner highlights)
- Colors: pastels and saturated vibrants
- Typography: rounded sans-serif, friendly weights
- Spacing scale: 4/8/12/16/24/32/48

## Color Palette

### Pastel Palette (Soft Clay)
```css
:root {
  --clay-pink: #FFB3BA;
  --clay-peach: #FFDFBA;
  --clay-yellow: #FFFFBA;
  --clay-mint: #BAFFC9;
  --clay-sky: #BAE1FF;
  --clay-lavender: #E0BBE4;
}
```

### Saturated Palette (Vibrant Clay)
```css
:root {
  --clay-coral: #FF6B6B;
  --clay-orange: #FFA94D;
  --clay-lime: #69DB7C;
  --clay-cyan: #38D9A9;
  --clay-blue: #4DABF7;
  --clay-purple: #B197FC;
}
```

## Design Tokens (CSS Custom Properties)
```css
:root {
  /* Shape */
  --clay-radius-sm: 16px;
  --clay-radius-md: 24px;
  --clay-radius-lg: 32px;
  --clay-radius-xl: 48px;

  /* Shadow System */
  --clay-shadow:
    8px 8px 16px rgba(0, 0, 0, 0.2),
    4px 4px 8px rgba(0, 0, 0, 0.1),
    inset 0px -8px 16px rgba(0, 0, 0, 0.1),
    inset 0px 8px 16px rgba(255, 255, 255, 0.6);

  --clay-shadow-hover:
    10px 10px 20px rgba(0, 0, 0, 0.25),
    6px 6px 12px rgba(0, 0, 0, 0.15),
    inset 0px -10px 20px rgba(0, 0, 0, 0.1),
    inset 0px 10px 20px rgba(255, 255, 255, 0.7);

  --clay-shadow-pressed:
    4px 4px 8px rgba(0, 0, 0, 0.2),
    2px 2px 4px rgba(0, 0, 0, 0.1),
    inset 0px -4px 8px rgba(0, 0, 0, 0.15),
    inset 0px 4px 8px rgba(255, 255, 255, 0.4);

  /* Typography */
  --font-clay: 'Nunito', 'Poppins', 'Quicksand', sans-serif;
}
```

## Component Examples

### Clay Button
```css
.clay-button {
  /* Shape */
  padding: 14px 28px;
  border-radius: var(--clay-radius-lg);
  border: none;

  /* Colors */
  background: linear-gradient(145deg, #FFB3BA, #FF8FA3);
  color: #333;

  /* 3D Effect */
  box-shadow: var(--clay-shadow);

  /* Typography */
  font-family: var(--font-clay);
  font-weight: 600;
  font-size: 16px;

  /* Interaction */
  cursor: pointer;
  transition: all 200ms ease;
}

.clay-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--clay-shadow-hover);
}

.clay-button:active {
  transform: translateY(2px);
  box-shadow: var(--clay-shadow-pressed);
}

.clay-button:focus-visible {
  outline: 3px solid var(--clay-blue);
  outline-offset: 2px;
}
```

### Clay Card
```css
.clay-card {
  padding: 24px;
  border-radius: var(--clay-radius-xl);
  background: linear-gradient(145deg, #BAE1FF, #8FC9F7);
  box-shadow: var(--clay-shadow);
}
```

### Clay Badge/Chip
```css
.clay-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 100px;  /* Pill shape */
  background: linear-gradient(145deg, #BAFFC9, #8FE8A3);
  box-shadow:
    4px 4px 8px rgba(0, 0, 0, 0.15),
    inset 0px -4px 8px rgba(0, 0, 0, 0.05),
    inset 0px 4px 8px rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 600;
}
```

### Clay Toggle
```css
.clay-toggle {
  width: 56px;
  height: 32px;
  border-radius: 100px;
  background: linear-gradient(145deg, #E0E0E0, #D0D0D0);
  box-shadow:
    inset 4px 4px 8px rgba(0, 0, 0, 0.1),
    inset -4px -4px 8px rgba(255, 255, 255, 0.5);
  position: relative;
  cursor: pointer;
  transition: background 200ms ease;
}

.clay-toggle-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(145deg, #FFFFFF, #F0F0F0);
  box-shadow:
    3px 3px 6px rgba(0, 0, 0, 0.15),
    inset 0px 2px 4px rgba(255, 255, 255, 0.8);
  position: absolute;
  top: 4px;
  left: 4px;
  transition: transform 200ms ease;
}

.clay-toggle.active {
  background: linear-gradient(145deg, #69DB7C, #51CF66);
}

.clay-toggle.active .clay-toggle-thumb {
  transform: translateX(24px);
}
```

### Clay Input
```css
.clay-input {
  width: 100%;
  padding: 14px 18px;
  border-radius: var(--clay-radius-md);
  border: none;
  background: linear-gradient(145deg, #F5F5F5, #EBEBEB);
  box-shadow:
    inset 4px 4px 8px rgba(0, 0, 0, 0.08),
    inset -4px -4px 8px rgba(255, 255, 255, 0.9);
  font-family: var(--font-clay);
  font-size: 16px;
}

.clay-input:focus {
  outline: none;
  box-shadow:
    inset 4px 4px 8px rgba(0, 0, 0, 0.12),
    inset -4px -4px 8px rgba(255, 255, 255, 0.9),
    0 0 0 3px rgba(77, 171, 247, 0.3);
}
```

## Motion & Animation
```css
.clay-transition {
  transition: all 200ms ease;
}

/* Duration tokens */
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;

/* Easing for bouncy clay feel */
--easing-clay: cubic-bezier(0.34, 1.56, 0.64, 1);  /* Overshoot */
--easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);

/* Hover lift animation */
.clay-hover {
  transition: transform 200ms var(--easing-clay), box-shadow 200ms ease;
}

.clay-hover:hover {
  transform: translateY(-4px) scale(1.02);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .clay-transition,
  .clay-hover {
    transition: none;
  }
}
```

## Accessibility Requirements
- WCAG 2.2 AA compliance
- Text contrast: 4.5:1 minimum (dark text on pastel backgrounds)
- Focus states: visible outline + offset
- Touch targets: minimum 44x44px
- Reduced motion: disable bouncy animations

```css
/* Text contrast on clay backgrounds */
.clay-element {
  color: #333333;  /* Dark text on pastel */
}

/* Focus states */
.clay-element:focus-visible {
  outline: 3px solid #4DABF7;
  outline-offset: 2px;
}
```

## Writing Tone
playful, friendly, soft, approachable, delightful

## Rules: Do
- Use very large border-radius (24px minimum)
- Apply multi-layer shadows (outer + inner)
- Use pastel or vibrant saturated colors
- Add subtle gradients for dimension
- Use rounded, friendly typography
- Apply bouncy hover animations
- Keep interfaces simple and uncluttered

## Rules: Don't
- Avoid sharp corners (breaks the soft aesthetic)
- Avoid single-layer flat shadows
- Avoid desaturated or dull colors
- Avoid heavy, serious typography
- Avoid using for data-dense interfaces
- Avoid overusing (visual fatigue)
- Avoid for enterprise/B2B applications

## Anti-Patterns (Common Mistakes)
```css
/* BAD: Sharp corners */
.clay-card {
  border-radius: 4px;  /* Too sharp for clay */
}

/* BAD: Single layer shadow */
.clay-card {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);  /* Missing inner shadows */
}

/* BAD: Desaturated colors */
.clay-button {
  background: #888888;  /* Too dull */
}

/* BAD: No inner highlight */
.clay-element {
  box-shadow: 8px 8px 16px rgba(0,0,0,0.2);  /* Missing inner glow */
}
```

## When to Use Claymorphism
- Children's apps and games
- Creative/playful brands
- Music/entertainment apps
- Onboarding flows
- Gamification elements (badges, achievements)
- Marketing/landing pages needing personality
- Consumer apps targeting younger audiences

## When NOT to Use Claymorphism
- Enterprise/B2B dashboards
- Financial applications
- Medical/healthcare UIs
- Data-heavy interfaces
- Professional tools
- Accessibility-critical apps
- Senior-focused products

## Quality Gates
- Border-radius is 24px minimum
- Multi-layer shadows present (outer + inner)
- Colors are pastel or saturated (not dull)
- Text contrast meets 4.5:1
- Focus states clearly visible
- Touch targets meet 44px minimum
- Reduced motion fallback provided

## QA Checklist
- [ ] Border-radius >= 24px on all clay elements
- [ ] Box-shadow includes inner highlight
- [ ] Box-shadow includes outer drop shadow
- [ ] Background uses gradient for dimension
- [ ] Colors are vibrant (pastel or saturated)
- [ ] Text has 4.5:1 contrast ratio
- [ ] Hover states feel "bouncy/lifted"
- [ ] Active states feel "pressed"
- [ ] Focus states visible with outline
- [ ] Touch targets >= 44px
- [ ] Reduced motion fallback provided
- [ ] Typography is rounded/friendly

<!-- TYPEUI_SH_MANAGED_END -->
