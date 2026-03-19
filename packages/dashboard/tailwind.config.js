/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Reference CSS custom properties so runtime theme-switching works
        'bg-base':      'var(--bg-base)',
        'bg-surface':   'var(--bg-surface)',
        'bg-elevated':  'var(--bg-elevated)',
        'bg-overlay':   'var(--bg-overlay)',
        'border-subtle':'var(--border-subtle)',
        'border-mid':   'var(--border-mid)',
        'border-strong':'var(--border-strong)',
        accent:         'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        success:        'var(--success)',
        warning:        'var(--warning)',
        danger:         'var(--danger)',
        'text-pri':     'var(--text-pri)',
        'text-sec':     'var(--text-sec)',
        'text-faint':   'var(--text-faint)',
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
