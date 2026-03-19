/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Use RGB channel vars so opacity modifiers (e.g. bg-accent/10) work at runtime
        'bg-base':       'rgb(var(--bg-base-ch) / <alpha-value>)',
        'bg-surface':    'rgb(var(--bg-surface-ch) / <alpha-value>)',
        'bg-elevated':   'rgb(var(--bg-elevated-ch) / <alpha-value>)',
        'bg-overlay':    'rgb(var(--bg-overlay-ch) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border-subtle-ch) / <alpha-value>)',
        'border-mid':    'rgb(var(--border-mid-ch) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong-ch) / <alpha-value>)',
        accent:          'rgb(var(--accent-ch) / <alpha-value>)',
        'accent-hover':  'rgb(var(--accent-hover-ch) / <alpha-value>)',
        success:         'rgb(var(--success-ch) / <alpha-value>)',
        warning:         'rgb(var(--warning-ch) / <alpha-value>)',
        danger:          'rgb(var(--danger-ch) / <alpha-value>)',
        'text-pri':      'rgb(var(--text-pri-ch) / <alpha-value>)',
        'text-sec':      'rgb(var(--text-sec-ch) / <alpha-value>)',
        'text-faint':    'rgb(var(--text-faint-ch) / <alpha-value>)',
      },
      fontFamily: {
        ui:   ['Inter', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        soft:   '0 4px 24px rgba(0,0,0,0.45)',
        accent: '0 0 0 1px var(--accent), 0 4px 20px var(--accent-glow)',
      },
    },
  },
  plugins: [],
};
