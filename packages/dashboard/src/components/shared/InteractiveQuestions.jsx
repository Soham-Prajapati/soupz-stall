import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, Square, CheckSquare, Circle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

// Parse [SOUPZ_Q]...[/SOUPZ_Q] blocks from AI content.
// Returns { before, questionsJson, after } or null if no block found.
export function parseSoupzQ(text) {
  const re = /\[SOUPZ_Q\]([\s\S]*?)\[\/SOUPZ_Q\]/;
  const m = re.exec(text);
  if (!m) return null;
  try {
    const questionsJson = JSON.parse(m[1].trim());
    return {
      before: text.slice(0, m.index),
      data: questionsJson,
      after: text.slice(m.index + m[0].length),
    };
  } catch {
    return null;
  }
}

// Format submitted answers into a human-readable string for the chat.
export function formatAnswers(questions, answers) {
  return questions
    .map(q => {
      const selected = answers[q.id] || [];
      const chosen = selected
        .map(v => (v.startsWith('__other__:') ? `Other: ${v.slice(10)}` : v))
        .join(', ');
      return `${q.text}\n  -> ${chosen || '(no answer)'}`;
    })
    .join('\n\n');
}

// ─── Single question card ────────────────────────────────────────────────────

function QuestionCard({ question, value, onChange, compact }) {
  const { id, text, description, options = [], multi = false } = question;
  const [otherText, setOtherText] = useState('');
  const otherInputRef = useRef(null);

  const allOptions = [...options, '__other__'];

  const isSelected = (opt) => {
    if (opt === '__other__') {
      return (value || []).some(v => v.startsWith('__other__:'));
    }
    return (value || []).includes(opt);
  };

  const otherValue = (() => {
    const v = (value || []).find(v => v.startsWith('__other__:'));
    return v ? v.slice(10) : '';
  })();

  function toggle(opt) {
    const current = value || [];
    if (multi) {
      if (opt === '__other__') {
        const has = current.some(v => v.startsWith('__other__:'));
        if (has) {
          onChange(current.filter(v => !v.startsWith('__other__:')));
          setOtherText('');
        } else {
          onChange([...current, `__other__:`]);
          setTimeout(() => otherInputRef.current?.focus(), 50);
        }
      } else {
        if (current.includes(opt)) {
          onChange(current.filter(v => v !== opt));
        } else {
          onChange([...current, opt]);
        }
      }
    } else {
      // single select
      if (opt === '__other__') {
        const has = current.some(v => v.startsWith('__other__:'));
        if (has) {
          onChange([]);
          setOtherText('');
        } else {
          onChange([`__other__:`]);
          setTimeout(() => otherInputRef.current?.focus(), 50);
        }
      } else {
        onChange(current.includes(opt) ? [] : [opt]);
      }
    }
  }

  function handleOtherInput(e) {
    const txt = e.target.value;
    setOtherText(txt);
    const current = (value || []).filter(v => !v.startsWith('__other__:'));
    onChange([...current, `__other__:${txt}`]);
  }

  function OptionIcon({ selected }) {
    if (multi) {
      return selected
        ? <CheckSquare size={14} className="text-accent shrink-0" />
        : <Square size={14} className="text-text-faint shrink-0" />;
    }
    return selected
      ? <CheckCircle size={14} className="text-accent shrink-0" />
      : <Circle size={14} className="text-text-faint shrink-0" />;
  }

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-lg overflow-hidden">
      <div className={cn('px-3.5 py-2.5 border-b border-border-subtle', compact ? 'px-3 py-2' : '')}>
        <p className={cn('text-text-pri font-ui font-medium leading-snug', compact ? 'text-xs' : 'text-sm')}>
          {text}
        </p>
        {description && !compact && (
          <p className="text-text-faint text-xs font-ui mt-0.5 leading-relaxed">{description}</p>
        )}
        {multi && (
          <span className="inline-block mt-1 text-[10px] font-ui text-text-faint bg-bg-surface border border-border-subtle px-1.5 py-0.5 rounded">
            Select all that apply
          </span>
        )}
      </div>

      <div className={cn('p-2 flex flex-col gap-1', compact ? 'p-1.5 gap-0.5' : '')}>
        {allOptions.map((opt) => {
          const sel = isSelected(opt);
          const isOther = opt === '__other__';
          return (
            <div key={opt}>
              <button
                type="button"
                onClick={() => toggle(opt)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-all font-ui',
                  compact ? 'px-2 py-1 text-xs gap-2' : 'text-sm',
                  sel
                    ? 'bg-accent/10 border border-accent/30 text-text-pri'
                    : 'border border-transparent text-text-sec hover:bg-bg-surface hover:text-text-pri hover:border-border-subtle',
                )}
              >
                <OptionIcon selected={sel} />
                <span className="flex-1">{isOther ? 'Other…' : opt}</span>
              </button>
              {isOther && sel && (
                <input
                  ref={otherInputRef}
                  type="text"
                  value={otherText || otherValue}
                  onChange={handleOtherInput}
                  placeholder="Type your answer…"
                  className={cn(
                    'mt-1 w-full bg-bg-surface border border-border-mid rounded-md font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors',
                    compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main InteractiveQuestions component ─────────────────────────────────────

export default function InteractiveQuestions({ data, onSubmit, compact = false }) {
  const questions = data?.questions || [];
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const cardRefs = useRef([]);

  // Determine if all required questions have at least one selection
  const allAnswered = questions.every(q => {
    const ans = answers[q.id] || [];
    if (ans.length === 0) return false;
    // If "other" is selected, it must have non-empty text
    const hasOther = ans.some(v => v.startsWith('__other__:'));
    if (hasOther) {
      const otherVal = ans.find(v => v.startsWith('__other__:'))?.slice(10) || '';
      if (!otherVal.trim()) return false;
    }
    return true;
  });

  function setAnswer(qId, val) {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  }

  function handleSubmit() {
    if (!allAnswered || submitted) return;
    setSubmitted(true);
    onSubmit(answers);
  }

  // Keyboard: Enter submits, arrow keys navigate between cards
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [allAnswered, submitted, answers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (questions.length === 0) return null;

  return (
    <div
      className={cn(
        'my-2 rounded-lg border border-border-mid bg-bg-surface overflow-hidden',
        compact ? '' : 'shadow-soft',
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 border-b border-border-subtle bg-bg-elevated',
        compact ? 'px-3 py-1.5' : 'px-3.5 py-2',
      )}>
        <ChevronRight size={compact ? 10 : 12} className="text-accent" />
        <span className={cn('font-ui font-medium text-text-sec', compact ? 'text-[11px]' : 'text-xs')}>
          {questions.length === 1 ? 'Question' : `${questions.length} questions`}
        </span>
        {submitted && (
          <span className="ml-auto text-[10px] font-ui text-success">Submitted</span>
        )}
      </div>

      {/* Questions */}
      <div className={cn('flex flex-col gap-3 p-3', compact ? 'gap-2 p-2' : '')}>
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(val) => setAnswer(q.id, val)}
            compact={compact}
          />
        ))}
      </div>

      {/* Submit */}
      <div className={cn(
        'px-3 pb-3 flex items-center gap-2',
        compact ? 'px-2 pb-2' : '',
      )}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitted}
          className={cn(
            'flex items-center gap-1.5 rounded-md font-ui font-medium transition-all',
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            allAnswered && !submitted
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-bg-elevated border border-border-subtle text-text-faint cursor-not-allowed',
          )}
        >
          {submitted ? 'Submitted' : 'Submit responses'}
        </button>
        {!submitted && (
          <span className={cn('text-text-faint font-ui', compact ? 'text-[10px]' : 'text-xs')}>
            Ctrl+Enter
          </span>
        )}
      </div>
    </div>
  );
}
