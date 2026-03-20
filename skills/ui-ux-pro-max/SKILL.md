# UI/UX Pro Max Design Intelligence

> Adapted from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) for Soupz agents.

## When to Use

Apply this skill when building UI components, pages, or applications. It provides design intelligence for professional, polished interfaces.

## Rule Priority (1 = highest)

### 1. Accessibility (WCAG 2.1 AA minimum)
- Contrast ratio: 4.5:1 for text, 3:1 for large text and UI elements
- Focus indicators: 2px solid outline with offset, visible on all interactive elements
- Labels: Every input must have an associated label (aria-label or visible)
- Keyboard navigation: All interactive elements reachable via Tab, actionable via Enter/Space
- Screen reader: Semantic HTML, ARIA roles where needed, meaningful alt text
- Color: Never use color alone to convey information

### 2. Touch & Interaction
- Minimum touch target: 44x44px (iOS HIG) / 48x48dp (Material)
- Touch target spacing: minimum 8px between targets
- Feedback: Every interactive element must respond to hover, focus, active states
- Loading states: Show feedback within 100ms of user action
- Disabled states: 40% opacity, cursor-not-allowed, aria-disabled

### 3. Performance
- Images: Use WebP/AVIF, responsive srcset, lazy loading below fold
- Fonts: Preload critical weights, display=swap, max 2 families
- CSS: Prefer transforms/opacity for animations (GPU-accelerated)
- Layout shift: Reserve space for async content (skeleton screens)
- Bundle: Code-split routes, lazy-load heavy components

### 4. Color Palette Rules
- **Maximum 5 colors** in active palette: background, surface, text, accent, semantic
- Semantic colors: success (green), warning (amber), danger (red) — used consistently
- Accent: One primary accent color for CTAs, links, active states
- Neutral: 4-5 shades for backgrounds and text (base, surface, elevated, text-primary, text-secondary)
- Never use raw hex in components — always reference design tokens

### 5. Typography Rules
- **Maximum 2 font families**: UI font + monospace font
- **Maximum 3 weights**: regular (400), medium (500), semibold (600)
- Type scale: Use consistent scale (e.g., 10, 11, 12, 13, 14, 16, 18, 24, 32)
- Line height: 1.4-1.6 for body text, 1.1-1.3 for headings
- Letter spacing: Wider for small uppercase text (0.05em), normal for body

### 6. Spacing System
- Use consistent spacing scale: 2, 4, 6, 8, 12, 16, 20, 24, 32, 48, 64
- Related items: 4-8px gap
- Groups: 12-16px gap
- Sections: 24-32px gap
- Page margins: 16px mobile, 24px tablet, 32px desktop
- Generous padding > cramped layout (when in doubt, add space)

### 7. Layout & Responsive
- Mobile-first: Design for 320px minimum, enhance up
- Breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl)
- Max content width: 1280px for content, 1440px for full-width
- Grid: Use CSS Grid or Flexbox, not floats
- Overflow: Hidden on containers, scroll only on designated scroll areas

### 8. Borders Over Shadows
- Structure: Use 1px borders (border-subtle) for visual separation
- Elevation: Borders for cards and containers, NOT shadows
- Shadows only on: Overlays (dropdowns, modals, tooltips, command palettes)
- When using shadows: Keep subtle — max 24px blur, low opacity
- No decorative shapes, blobs, or background elements without clear purpose

### 9. Animation & Motion
- Duration: 150ms for micro-interactions, 200-300ms for transitions, 400-600ms for page
- Easing: cubic-bezier(0.2, 0, 0, 1) for enter, cubic-bezier(0.4, 0, 1, 1) for exit
- Respect prefers-reduced-motion: @media query to disable non-essential animation
- Every animation must have purpose — don't animate for decoration
- Transform + opacity only for smooth 60fps

### 10. Component Patterns
- Buttons: Primary (accent bg), Secondary (border), Tertiary (text only)
- Inputs: Border-subtle default, border-accent on focus, border-danger on error
- Cards: Border + bg-surface, no shadow unless hoverable/interactive
- Modals: Overlay bg-black/50, centered, max-width 480px
- Dropdowns: Border + bg-elevated, z-index 50+, max-height with scroll

### 11. Forms & Validation
- Labels above inputs (not floating)
- Error messages below field, in danger color
- Validate on blur, not on every keystroke
- Show success state briefly after correction
- Disabled submit until form is valid

### 12. Empty, Loading, Error States
- Empty: Icon + message + action (never blank space)
- Loading: Skeleton screens preferred over spinners for layout
- Error: Specific message + retry action + support link
- Offline: Persistent banner with reconnection status

## Soupz-Specific Overrides
- Font UI: Inter (400, 500, 600 only)
- Font Mono: JetBrains Mono (400, 500 only)
- Radius: sm(4px), md(6px), lg(8px), xl(12px)
- Accent: Indigo (#6366F1 in dark theme)
- 12 theme support via CSS custom properties with RGB channels

## Pre-Delivery Checklist
- [ ] All text passes 4.5:1 contrast
- [ ] All interactive elements have hover/focus/active states
- [ ] Empty, loading, and error states designed
- [ ] Mobile layout works at 320px width
- [ ] No raw hex colors (all tokenized)
- [ ] Max 2 font families, max 3 weights
- [ ] Borders used for structure, shadows only on overlays
- [ ] Touch targets >= 44px on mobile
- [ ] prefers-reduced-motion respected
- [ ] Semantic HTML (button for actions, a for navigation)
