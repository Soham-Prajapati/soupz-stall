import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function InteractiveQuestions({ data, onAnswer }) {
  const questions = data?.questions || [];
  const [answers, setAnswers] = useState({});

  const toggleOption = (qId, option, multi) => {
    setAnswers(prev => {
      const current = prev[qId] || [];
      if (multi) {
        if (current.includes(option)) {
          return { ...prev, [qId]: current.filter(o => o !== option) };
        } else {
          return { ...prev, [qId]: [...current, option] };
        }
      } else {
        return { ...prev, [qId]: [option] };
      }
    });
  };

  const isSelected = (qId, option) => {
    return (answers[qId] || []).includes(option);
  };

  const allAnswered = questions.every(q => (answers[q.id] || []).length > 0);

  const handleContinue = () => {
    if (!allAnswered) return;
    onAnswer(answers);
  };

  if (questions.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 my-4">
      {questions.map((q) => (
        <div key={q.id} className="bg-bg-elevated border border-border-subtle rounded-xl p-4 shadow-sm">
          <h4 className="text-text-pri text-sm font-ui font-medium mb-3">{q.text}</h4>
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => {
              const selected = isSelected(q.id, opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggleOption(q.id, opt, q.multi)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-ui border transition-all",
                    selected
                      ? "bg-accent/15 border-accent text-text-pri"
                      : "bg-bg-surface border-border-subtle text-text-sec hover:border-border-mid"
                  )}
                >
                  {selected && <Check size={12} className="text-accent" />}
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        onClick={handleContinue}
        disabled={!allAnswered}
        className={cn(
          "w-full py-2 rounded-lg text-sm font-ui font-medium transition-all",
          allAnswered
            ? "bg-accent hover:bg-accent-hover text-white cursor-pointer"
            : "bg-bg-elevated text-text-faint cursor-not-allowed border border-border-subtle"
        )}
      >
        Continue
      </button>
    </div>
  );
}
