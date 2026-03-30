import { useEffect, useMemo, useState } from 'react';

const DEFAULT_KEYS = [
  '--bg-base',
  '--bg-surface',
  '--bg-elevated',
  '--bg-overlay',
  '--text-pri',
  '--text-sec',
  '--accent',
  '--accent-hover',
  '--border-subtle',
];

function readVars(keys) {
  if (typeof window === 'undefined') return {};
  const style = getComputedStyle(document.documentElement);
  return keys.reduce((acc, key) => {
    acc[key] = style.getPropertyValue(key)?.trim() || '';
    return acc;
  }, {});
}

export function useThemeVars(keys = DEFAULT_KEYS) {
  const deps = useMemo(() => keys.join('|'), [keys]);
  const [values, setValues] = useState(() => readVars(keys));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handle = () => setValues(readVars(keys));
    handle();
    const observer = new MutationObserver((mutations) => {
      if (mutations.some(m => m.attributeName === 'data-theme')) handle();
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [deps]);

  return values;
}
