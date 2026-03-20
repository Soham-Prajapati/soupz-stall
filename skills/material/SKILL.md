<!-- TYPEUI_SH_MANAGED_START -->
# Material Design 3 (M3) System Skill

## Mission
You are an expert design-system guideline author specializing in Google's Material Design 3.
Create practical, implementation-ready guidance following M3's systematic approach to color, typography, shape, and motion.

## Brand Philosophy
Material Design 3 is Google's most sophisticated design system, introducing dynamic color generation, expressive typography, and refined component patterns. M3 emphasizes personalization (via dynamic color), accessibility (baked into token structure), and cross-platform consistency. The system uses design tokens at three tiers: reference (primitives), system (semantic), and component (specific).

## Three-Tier Token Architecture

### Tier 1: Reference Tokens (Primitives)
Raw, immutable values:
```css
/* Color palette tones */
--md-ref-palette-primary40: #6750A4;
--md-ref-palette-primary80: #D0BCFF;
--md-ref-palette-neutral90: #E6E1E5;

/* Typography */
--md-ref-typeface-brand: 'Roboto';
--md-ref-typeface-plain: 'Roboto';
```

### Tier 2: System Tokens (Semantic)
Context-aware, mode-dependent:
```css
/* Light mode */
:root {
  --md-sys-color-primary: var(--md-ref-palette-primary40);
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: var(--md-ref-palette-primary90);
  --md-sys-color-on-primary-container: var(--md-ref-palette-primary10);

  --md-sys-color-surface: var(--md-ref-palette-neutral99);
  --md-sys-color-on-surface: var(--md-ref-palette-neutral10);
}

/* Dark mode */
.dark {
  --md-sys-color-primary: var(--md-ref-palette-primary80);
  --md-sys-color-on-primary: var(--md-ref-palette-primary20);
  --md-sys-color-primary-container: var(--md-ref-palette-primary30);
  --md-sys-color-on-primary-container: var(--md-ref-palette-primary90);
}
```

### Tier 3: Component Tokens (Specific)
Applied to component states:
```css
--md-comp-filled-button-container-color: var(--md-sys-color-primary);
--md-comp-filled-button-label-text-color: var(--md-sys-color-on-primary);
--md-comp-filled-button-disabled-container-color: rgba(var(--md-sys-color-on-surface-rgb), 0.12);
--md-comp-filled-button-disabled-label-text-color: rgba(var(--md-sys-color-on-surface-rgb), 0.38);
```

## Color System (29 Roles)

### Key Color Categories
```css
:root {
  /* Primary (main brand color) */
  --md-sys-color-primary: #6750A4;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #EADDFF;
  --md-sys-color-on-primary-container: #21005D;

  /* Secondary (supporting) */
  --md-sys-color-secondary: #625B71;
  --md-sys-color-on-secondary: #FFFFFF;
  --md-sys-color-secondary-container: #E8DEF8;
  --md-sys-color-on-secondary-container: #1D192B;

  /* Tertiary (accent balance) */
  --md-sys-color-tertiary: #7D5260;
  --md-sys-color-on-tertiary: #FFFFFF;
  --md-sys-color-tertiary-container: #FFD8E4;
  --md-sys-color-on-tertiary-container: #31111D;

  /* Error */
  --md-sys-color-error: #B3261E;
  --md-sys-color-on-error: #FFFFFF;
  --md-sys-color-error-container: #F9DEDC;
  --md-sys-color-on-error-container: #410E0B;

  /* Surface (backgrounds) */
  --md-sys-color-surface: #FEF7FF;
  --md-sys-color-on-surface: #1D1B20;
  --md-sys-color-surface-variant: #E7E0EC;
  --md-sys-color-on-surface-variant: #49454F;

  /* Surface containers (elevation) */
  --md-sys-color-surface-container-lowest: #FFFFFF;
  --md-sys-color-surface-container-low: #F7F2FA;
  --md-sys-color-surface-container: #F3EDF7;
  --md-sys-color-surface-container-high: #ECE6F0;
  --md-sys-color-surface-container-highest: #E6E0E9;

  /* Utility */
  --md-sys-color-outline: #79747E;
  --md-sys-color-outline-variant: #CAC4D0;
  --md-sys-color-scrim: #000000;
}
```

### Tonal Palette (13 tones per color)
```
0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100
```

Light theme mapping: Primary = tone 40, Container = tone 90
Dark theme mapping: Primary = tone 80, Container = tone 30

## Typography Scale (15 Styles)

```css
:root {
  /* Display */
  --md-sys-typescale-display-large: 57px/64px 400 -0.25px;
  --md-sys-typescale-display-medium: 45px/52px 400 0;
  --md-sys-typescale-display-small: 36px/44px 400 0;

  /* Headline */
  --md-sys-typescale-headline-large: 32px/40px 400 0;
  --md-sys-typescale-headline-medium: 28px/36px 400 0;
  --md-sys-typescale-headline-small: 24px/32px 400 0;

  /* Title */
  --md-sys-typescale-title-large: 22px/28px 400 0;
  --md-sys-typescale-title-medium: 16px/24px 500 0.15px;
  --md-sys-typescale-title-small: 14px/20px 500 0.1px;

  /* Body */
  --md-sys-typescale-body-large: 16px/24px 400 0.5px;
  --md-sys-typescale-body-medium: 14px/20px 400 0.25px;
  --md-sys-typescale-body-small: 12px/16px 400 0.4px;

  /* Label */
  --md-sys-typescale-label-large: 14px/20px 500 0.1px;
  --md-sys-typescale-label-medium: 12px/16px 500 0.5px;
  --md-sys-typescale-label-small: 11px/16px 500 0.5px;
}
```

### Usage Guidelines
- **Display**: Hero text, large numerals
- **Headline**: Section headers
- **Title**: Card titles, medium-emphasis headers
- **Body**: Long-form reading content
- **Label**: Buttons, tabs, navigation

## State Layer System

M3 uses transparent overlays for interactive states:

| State | Opacity | Description |
|-------|---------|-------------|
| Enabled | 0% | Default |
| Hovered | 8% | Mouse hover |
| Focused | 10% | Keyboard focus |
| Pressed | 10% | Active/clicked |
| Dragged | 16% | Being dragged |
| Disabled (container) | 12% | Non-interactive |
| Disabled (content) | 38% | Non-interactive text |

### Implementation
```css
.md-button {
  position: relative;
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

/* State layer */
.md-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--md-sys-color-on-primary);
  opacity: 0;
  transition: opacity 200ms;
}

.md-button:hover::before {
  opacity: 0.08;
}

.md-button:focus-visible::before {
  opacity: 0.10;
}

.md-button:active::before {
  opacity: 0.10;
}

.md-button:disabled {
  background: rgba(var(--md-sys-color-on-surface-rgb), 0.12);
  color: rgba(var(--md-sys-color-on-surface-rgb), 0.38);
}
```

## Motion System

### Duration Tokens
```css
:root {
  --md-sys-motion-duration-short1: 50ms;
  --md-sys-motion-duration-short2: 100ms;
  --md-sys-motion-duration-short3: 150ms;
  --md-sys-motion-duration-short4: 200ms;
  --md-sys-motion-duration-medium1: 250ms;
  --md-sys-motion-duration-medium2: 300ms;
  --md-sys-motion-duration-medium3: 350ms;
  --md-sys-motion-duration-medium4: 400ms;
  --md-sys-motion-duration-long1: 450ms;
  --md-sys-motion-duration-long2: 500ms;
}
```

### Easing Curves
```css
:root {
  /* Standard - elements moving within view */
  --md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-standard-decelerate: cubic-bezier(0, 0, 0, 1);
  --md-sys-motion-easing-standard-accelerate: cubic-bezier(0.3, 0, 1, 1);

  /* Emphasized - expressive motion */
  --md-sys-motion-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
}
```

### Usage
- **Standard**: Utility animations (hover, focus)
- **Standard Decelerate**: Elements entering view
- **Standard Accelerate**: Elements exiting view
- **Emphasized**: Hero moments, significant transitions

## Elevation System (Tonal Elevation)

M3 uses surface tint + shadows:

| Level | Shadow | Surface Tint Opacity |
|-------|--------|---------------------|
| Level 0 | none | 0% |
| Level 1 | 1dp | 5% |
| Level 2 | 3dp | 8% |
| Level 3 | 6dp | 11% |
| Level 4 | 8dp | 12% |
| Level 5 | 12dp | 14% |

```css
.md-elevation-1 {
  box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15);
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 5%, var(--md-sys-color-surface));
}

.md-elevation-3 {
  box-shadow: 0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3);
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 11%, var(--md-sys-color-surface));
}
```

## Shape System

```css
:root {
  --md-sys-shape-corner-none: 0px;
  --md-sys-shape-corner-extra-small: 4px;
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-extra-large: 28px;
  --md-sys-shape-corner-full: 9999px;
}
```

### Component Shape Mapping
- Buttons: Small (8px)
- Cards: Medium (12px)
- Dialogs: Extra Large (28px)
- FABs: Large (16px) or Full
- Chips: Small (8px)
- Text fields: Extra Small (4px) top only

## Component Examples

### M3 Button (Filled)
```css
.md-button-filled {
  height: 40px;
  padding: 0 24px;
  border-radius: var(--md-sys-shape-corner-full);
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font: var(--md-sys-typescale-label-large);
  position: relative;
  overflow: hidden;
  transition:
    box-shadow var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.md-button-filled:hover {
  box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15);
}

.md-button-filled:focus-visible {
  outline: none;
}

/* State layer */
.md-button-filled::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--md-sys-color-on-primary);
  opacity: 0;
  transition: opacity var(--md-sys-motion-duration-short2);
}

.md-button-filled:hover::before { opacity: 0.08; }
.md-button-filled:focus::before { opacity: 0.10; }
.md-button-filled:active::before { opacity: 0.10; }
```

### M3 Card
```css
.md-card {
  border-radius: var(--md-sys-shape-corner-medium);
  background: var(--md-sys-color-surface-container-low);
  padding: 16px;
}

.md-card-elevated {
  background: var(--md-sys-color-surface-container-low);
  box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15);
}

.md-card-filled {
  background: var(--md-sys-color-surface-container-highest);
  box-shadow: none;
}

.md-card-outlined {
  background: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
}
```

### M3 Text Field (Outlined)
```css
.md-text-field {
  position: relative;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-extra-small);
  background: transparent;
  padding: 16px;
  transition: border-color var(--md-sys-motion-duration-short2);
}

.md-text-field:focus-within {
  border-color: var(--md-sys-color-primary);
  border-width: 2px;
}

.md-text-field-label {
  position: absolute;
  top: 50%;
  left: 16px;
  transform: translateY(-50%);
  font: var(--md-sys-typescale-body-large);
  color: var(--md-sys-color-on-surface-variant);
  transition: all var(--md-sys-motion-duration-short2);
  pointer-events: none;
}

.md-text-field:focus-within .md-text-field-label,
.md-text-field.has-value .md-text-field-label {
  top: 0;
  font: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-primary);
  background: var(--md-sys-color-surface);
  padding: 0 4px;
}
```

## Accessibility Requirements
- WCAG 2.2 AA: 4.5:1 text contrast, 3:1 UI
- All `on-*` colors meet contrast against paired color
- Focus indicators: 2px minimum, 3:1 contrast
- Touch targets: 48x48px minimum
- Motion: respect prefers-reduced-motion
- Screen reader: semantic HTML + ARIA

## Style Foundations
- Visual style: modern, systematic, accessible, expressive, personalized
- Color: semantic tokens with automatic accessibility
- Typography: 15-style scale with clear hierarchy
- Shape: 7-tier corner radius scale
- Motion: purposeful with standardized duration/easing
- Elevation: tonal (surface tint) + shadow combination

## Writing Tone
systematic, accessible, expressive, cross-platform, polished

## Rules: Do
- Use three-tier token architecture
- Pair colors with on-colors for accessibility
- Use state layers for interactive states
- Apply tonal elevation (not just shadows)
- Follow typography scale strictly
- Respect motion preferences
- Use shape scale consistently

## Rules: Don't
- Avoid hardcoding colors (use tokens)
- Avoid single-layer shadows without surface tint
- Avoid custom typography outside scale
- Avoid motion without reduced-motion fallback
- Avoid mixing M3 with other design systems

## Quality Gates
- Three-tier token structure implemented
- All colors have corresponding on-colors
- State layer opacity matches M3 spec
- Typography uses M3 scale names
- Shape uses M3 corner tokens
- Motion uses M3 duration/easing
- WCAG AA contrast met automatically

## QA Checklist
- [ ] Token architecture: reference > system > component
- [ ] Color roles: primary/secondary/tertiary/error + containers
- [ ] Typography: display/headline/title/body/label scale
- [ ] State layers: hover 8%, focus 10%, pressed 10%
- [ ] Shapes: extra-small through full scale
- [ ] Elevation: combines shadow + surface tint
- [ ] Motion: duration-short/medium/long + easing curves
- [ ] Dark mode: tokens invert correctly
- [ ] Accessibility: on-colors meet contrast requirements
- [ ] Reduced motion: animations disable

<!-- TYPEUI_SH_MANAGED_END -->
