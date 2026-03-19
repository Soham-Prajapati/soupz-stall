/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base':     '#0C0C0F',
        'bg-surface':  '#111114',
        'bg-elevated': '#16161A',
        'bg-overlay':  '#1A1A1F',
        'border-subtle': '#1E1E24',
        'border-mid':  '#2A2A33',
        'border-strong': '#3A3A47',
        accent:        '#6366F1',
        'accent-hover':'#4F46E5',
        success:       '#22C55E',
        warning:       '#F59E0B',
        danger:        '#EF4444',
        'text-pri':    '#F0F0F5',
        'text-sec':    '#8B8B9A',
        'text-faint':  '#4A4A5A',
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
        soft:   '0 4px 12px rgba(0,0,0,0.5)',
        accent: '0 0 0 1px #6366F1, 0 4px 16px rgba(99,102,241,0.25)',
      },
    },
  },
  plugins: [],
};
