<!-- TYPEUI_SH_MANAGED_START -->
# shadcn/ui Design System Skill

## Mission
You are an expert design-system guideline author specializing in shadcn/ui patterns.
Create practical, implementation-ready guidance for clean, minimal, accessible component systems using Tailwind CSS and Radix UI primitives.

## Brand Philosophy
shadcn/ui is not a component library - it's a collection of beautifully designed, accessible components you own. The style embodies Vercel's design language: minimal, functional, and polished. Components are built on Radix UI primitives for robust accessibility, styled with Tailwind CSS, and use CVA (class-variance-authority) for type-safe variants. The aesthetic is clean, professional, and developer-friendly.

## Why shadcn/ui is Industry-Leading

1. **Ownership Model**: You copy source code into your project, not install a package
2. **Accessibility**: Built on Radix UI primitives (keyboard, screen reader, focus management)
3. **Tailwind-First**: No CSS-in-JS runtime, just classes
4. **Type Safety**: Full TypeScript with CVA for variants
5. **Theming**: HSL CSS variables for instant dark mode
6. **Customization**: Modify any component freely

## Core CSS Token System

### HSL Variables (The Key Innovation)
Variables store HSL values WITHOUT `hsl()` wrapper for Tailwind opacity modifiers:
```css
:root {
  /* Store raw HSL values */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;

  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;

  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;

  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;

  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;

  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;

  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;

  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;

  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;

  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;

  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
}
```

### Tailwind Config Mapping
```javascript
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
}
```

## Style Foundations
- Visual style: minimal, clean, functional, polished, professional
- Typography: Geist or Inter, clean sans-serif
- Colors: Neutral-heavy with semantic accents
- Spacing: Tailwind defaults (4px base)
- Border-radius: 0.5rem base, derived sm/md/lg
- Shadows: Subtle, functional

## The cn() Utility (Critical Pattern)
```typescript
// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  className  // Allow override
)} />
```

## CVA (Class Variance Authority) Pattern
```typescript
// Button with CVA variants
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  // Base styles (always applied)
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

## Component Architecture

### Layered Structure
```
Radix UI Primitive (accessibility, behavior)
    └── Styled wrapper (Tailwind + CVA)
        └── Your component (full customization)
```

### Button Component (Full Example)
```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Card Component (Compound Pattern)
```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
)

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
)

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
)

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

### Usage
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

## Radix UI Integration (Accessibility)

### Dialog Example
```tsx
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
}
```

## Key Patterns

### asChild Pattern (Polymorphism)
```tsx
// Button renders as <a> tag
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>
```

### Data Attributes for State
```tsx
className={cn(
  "data-[state=open]:animate-in",
  "data-[state=closed]:animate-out",
  "data-[state=checked]:bg-primary"
)}
```

### forwardRef (Always)
```tsx
const Component = React.forwardRef<ElementType, Props>(
  ({ className, ...props }, ref) => (
    <element ref={ref} className={cn("base", className)} {...props} />
  )
)
Component.displayName = "Component"
```

## Accessibility (Radix Provides)
- Keyboard navigation (Tab, Arrow keys, Enter, Escape)
- Focus management (trapping, return focus)
- ARIA attributes (roles, states, properties)
- Screen reader announcements
- Reduced motion support

## Component Families
- buttons (variants: default, destructive, outline, secondary, ghost, link)
- inputs
- textareas
- selects
- checkboxes
- radio groups
- switches
- sliders
- cards
- dialogs/modals
- sheets (drawers)
- popovers
- dropdowns
- tooltips
- tabs
- accordions
- alerts
- toasts
- badges
- avatars
- skeletons
- command (cmdk)
- calendars
- date pickers

## Writing Tone
minimal, functional, clean, professional, developer-friendly

## Rules: Do
- Use HSL CSS variables for theming
- Use cn() for className merging
- Use CVA for variant management
- Build on Radix primitives for complex components
- Always forwardRef for composition
- Always include focus-visible states
- Use semantic color tokens (primary, secondary, muted)
- Support dark mode via .dark class

## Rules: Don't
- Avoid custom CSS when Tailwind suffices
- Avoid hardcoding colors (use tokens)
- Avoid removing focus states
- Avoid complex CSS-in-JS
- Avoid non-semantic class names
- Avoid ignoring accessibility

## Anti-Patterns
```tsx
/* BAD: Hardcoded colors */
<button className="bg-blue-500">  {/* Use bg-primary */}

/* BAD: Missing focus states */
<button className="...">  {/* Missing focus-visible:ring-2 */}

/* BAD: Not using cn() for merging */
<div className={`base ${className}`}>  {/* Use cn() */}

/* BAD: Not forwarding refs */
const Button = (props) => <button {...props} />  {/* Use forwardRef */}
```

## Quality Gates
- Components use forwardRef
- Components use cn() for class merging
- Focus states include ring-2 ring-ring
- Variants managed via CVA
- Colors use semantic tokens
- Dark mode works automatically
- Accessible via keyboard

## QA Checklist
- [ ] Uses HSL CSS variables for colors
- [ ] cn() utility for class merging
- [ ] CVA for variant management
- [ ] forwardRef on all components
- [ ] focus-visible states present
- [ ] Radix primitives for complex components
- [ ] Dark mode supported via .dark class
- [ ] Semantic color tokens (not hardcoded)
- [ ] Keyboard navigation works
- [ ] Screen reader accessible
- [ ] displayName set on components

<!-- TYPEUI_SH_MANAGED_END -->
