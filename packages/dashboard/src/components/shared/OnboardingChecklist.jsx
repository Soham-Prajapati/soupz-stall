import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Wifi, Zap, GitCommit, Monitor, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/cn';
import { trackEvent } from '../../lib/instrumentation.js';

const CHECKLIST_KEY = 'soupz_onboarding_checklist';

const INITIAL_ITEMS = [
  { id: 'pair',      label: 'Pair your first machine', icon: Wifi,      desc: 'Access your local environment from any browser.' },
  { id: 'deep_run',  label: 'Run a Deep orchestration', icon: Zap,       desc: 'Watch multiple agents solve a complex task in parallel.' },
  { id: 'commit',    label: 'Commit a change remotely', icon: GitCommit, desc: 'Complete the dev loop without touching your laptop.' },
  { id: 'preview',   label: 'Preview a live dev server', icon: Monitor,   desc: 'See your UI changes render in real-time.' },
];

export default function OnboardingChecklist({ workspaceOnline, devServerUrl }) {
  const [items, setItems] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}');
      return INITIAL_ITEMS.map(item => ({ ...item, completed: !!stored[item.id] }));
    } catch {
      return INITIAL_ITEMS.map(item => ({ ...item, completed: false }));
    }
  });

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('soupz_checklist_collapsed') === 'true';
  });

  const [hidden, setHidden] = useState(() => {
    return localStorage.getItem('soupz_checklist_hidden') === 'true';
  });

  // Auto-complete pairing
  useEffect(() => {
    if (workspaceOnline) completeItem('pair');
  }, [workspaceOnline]);

  // Auto-complete preview
  useEffect(() => {
    if (devServerUrl) completeItem('preview');
  }, [devServerUrl]);

  // Listen for custom events (e.g. from CoreConsole or GitPanel)
  useEffect(() => {
    const handleComplete = (e) => {
      if (e.detail?.id) completeItem(e.detail.id);
    };
    window.addEventListener('soupz_complete_onboarding_item', handleComplete);
    return () => window.removeEventListener('soupz_complete_onboarding_item', handleComplete);
  }, []);

  function completeItem(id) {
    setItems(prev => {
      const next = prev.map(item => item.id === id ? { ...item, completed: true } : item);
      const stored = next.reduce((acc, item) => ({ ...acc, [item.id]: item.completed }), {});
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(stored));
      
      const wasAlreadyCompleted = prev.find(i => i.id === id)?.completed;
      if (!wasAlreadyCompleted) {
        trackEvent('onboarding_item_completed', { id });
      }
      
      return next;
    });
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('soupz_checklist_collapsed', String(next));
  }

  function hidePermanently() {
    setHidden(true);
    localStorage.setItem('soupz_checklist_hidden', 'true');
    trackEvent('onboarding_checklist_dismissed');
  }

  const completedCount = items.filter(i => i.completed).length;
  const allCompleted = completedCount === items.length;

  if (hidden || (allCompleted && collapsed)) return null;

  return (
    <div className={cn(
      "fixed bottom-20 right-6 z-40 w-72 bg-bg-surface border border-border-subtle rounded-xl shadow-2xl transition-all duration-300",
      collapsed ? "h-12 overflow-hidden" : "p-4"
    )}>
      {/* Header */}
      <div className={cn("flex items-center justify-between", collapsed ? "h-full px-4" : "mb-4")}>
        <div className="flex items-center gap-2">
          <div className="relative w-5 h-5">
            <svg className="w-5 h-5 -rotate-90">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-border-subtle" />
              <circle
                cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"
                strokeDasharray={2 * Math.PI * 8}
                strokeDashoffset={2 * Math.PI * 8 * (1 - completedCount / items.length)}
                className="text-accent transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
              {completedCount}/{items.length}
            </span>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-text-pri">Onboarding</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleCollapsed} className="p-1 hover:bg-bg-elevated rounded transition-colors text-text-faint">
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {!collapsed && (
            <button onClick={hidePermanently} className="p-1 hover:bg-bg-elevated rounded transition-colors text-text-faint">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="flex items-start gap-3 group">
              <div className={cn(
                "mt-0.5 transition-colors",
                item.completed ? "text-success" : "text-text-faint group-hover:text-text-sec"
              )}>
                {item.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              </div>
              <div>
                <p className={cn(
                  "text-xs font-medium transition-colors",
                  item.completed ? "text-text-faint line-through" : "text-text-pri"
                )}>
                  {item.label}
                </p>
                {!item.completed && (
                  <p className="text-[10px] text-text-faint mt-0.5 leading-relaxed">
                    {item.desc}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          {allCompleted && (
            <div className="mt-4 pt-3 border-t border-border-subtle text-center">
              <p className="text-[11px] text-success font-bold uppercase tracking-widest">Setup Complete!</p>
              <button 
                onClick={hidePermanently}
                className="mt-2 text-[10px] text-text-faint hover:text-text-sec underline transition-colors"
              >
                Dismiss checklist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
