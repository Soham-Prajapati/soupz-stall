import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Code2, Sparkles, X } from 'lucide-react';
import { cn } from '../../lib/cn';

const ONBOARDING_CARDS = [
  {
    id: 1,
    title: 'Chat with AI Agents',
    description: 'Ask questions, write code, or debug issues. Your agents respond in real-time. Switch between Claude, Gemini, Copilot, and more.',
    icon: MessageSquare,
  },
  {
    id: 2,
    title: 'Edit Code from Anywhere',
    description: 'Full IDE mode with Monaco editor, file tree, git staging, and terminal. Control your entire development environment from your phone.',
    icon: Code2,
  },
  {
    id: 3,
    title: 'Build with Builder Mode',
    description: 'Chat + live preview. Design UIs with natural language and see changes render instantly. Perfect for rapid prototyping.',
    icon: Sparkles,
  },
];

export default function OnboardingOverlay() {
  const [shown, setShown] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onboarded = localStorage.getItem('soupz_onboarded');
    if (!onboarded) {
      setShown(true);
    }
  }, []);

  if (!mounted || !shown) return null;

  const card = ONBOARDING_CARDS[currentCard];
  const Icon = card.icon;
  const isLastCard = currentCard === ONBOARDING_CARDS.length - 1;

  function handleDismiss() {
    localStorage.setItem('soupz_onboarded', 'true');
    setShown(false);
  }

  function handleNext() {
    if (isLastCard) {
      handleDismiss();
    } else {
      setCurrentCard(c => c + 1);
    }
  }

  function handlePrev() {
    setCurrentCard(c => Math.max(0, c - 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg hover:bg-bg-elevated transition-colors text-text-faint hover:text-text-sec"
          title="Skip"
        >
          <X size={18} />
        </button>

        {/* Card Content */}
        <div className="p-10 pt-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-8 shadow-inner">
            <Icon size={32} className="text-accent" />
          </div>

          <h2 className="text-2xl font-black mb-4 tracking-tighter text-text-pri">
            {card.title}
          </h2>

          <p className="text-text-sec font-medium leading-relaxed mb-12">
            {card.description}
          </p>

          {/* Dot Indicators */}
          <div className="flex gap-2 mb-10">
            {ONBOARDING_CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentCard(i)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === currentCard ? 'w-8 bg-accent' : 'w-2 bg-border-subtle hover:bg-border-mid'
                )}
                title={`Go to card ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={handlePrev}
              disabled={currentCard === 0}
              className={cn(
                'flex items-center justify-center p-2 rounded-lg transition-all',
                currentCard === 0
                  ? 'text-text-faint bg-bg-base cursor-not-allowed'
                  : 'text-text-sec hover:text-text-pri hover:bg-bg-elevated'
              )}
              title="Previous"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={handleNext}
              className="flex-1 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition-colors"
            >
              {isLastCard ? 'Got it' : 'Next'}
            </button>

            <button
              onClick={handleNext}
              disabled={isLastCard}
              className={cn(
                'flex items-center justify-center p-2 rounded-lg transition-all',
                isLastCard
                  ? 'text-text-faint bg-bg-base cursor-not-allowed'
                  : 'text-text-sec hover:text-text-pri hover:bg-bg-elevated'
              )}
              title="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-bg-base">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${((currentCard + 1) / ONBOARDING_CARDS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
