import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function Select({ value, onChange, options, className, placeholder = 'Select an option' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Handle both precise types and stringified fallback matches
  const selectedOption = options.find(o => o.value === value) || options.find(o => String(o.value) === String(value));

  return (
    <div className={cn('relative font-ui', className)} ref={containerRef}>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='w-full flex items-center justify-between gap-2.5 rounded-md bg-bg-surface border border-border-subtle hover:border-border-mid px-3 py-1.5 text-xs text-text-pri focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all text-left shadow-sm font-medium'
      >
        <span className='truncate'>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={14} className='text-text-faint shrink-0' />
      </button>

      {open && (
        <div className='absolute top-full left-0 mt-1 w-full min-w-[max-content] bg-bg-elevated border border-border-mid rounded-xl shadow-soft z-[100] max-h-60 overflow-y-auto custom-scrollbar flex flex-col py-1'>
          {options.map((opt) => (
            <button
              key={opt.value}
              type='button'
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-bg-overlay transition-colors',
                value === opt.value ? 'bg-bg-overlay text-text-pri font-medium' : 'text-text-sec'
              )}
            >
              <span className='truncate pr-4'>{opt.label}</span>
              {value === opt.value && <Check size={14} className='text-accent shrink-0' />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
