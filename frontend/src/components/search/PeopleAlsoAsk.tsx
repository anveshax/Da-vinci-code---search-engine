import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

interface PeopleAlsoAskProps {
  questions: string[];
  onSelectQuestion: (question: string) => void;
}

export const PeopleAlsoAsk: React.FC<PeopleAlsoAskProps> = ({
  questions,
  onSelectQuestion,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!questions || questions.length === 0) {
    return null;
  }

  const toggleRow = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section aria-label="People also ask" className="my-6 max-w-[652px] text-left">
      <h3 className="text-[18px] sm:text-[20px] font-normal text-[#e8eaed] mb-2.5">
        People also ask
      </h3>

      <div className="rounded-xl border border-[#3c4043] divide-y divide-[#3c4043] bg-[#282a2c] overflow-hidden">
        {questions.map((question, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div key={idx} className="transition-colors">
              <button
                type="button"
                onClick={() => toggleRow(idx)}
                className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 text-sm font-sans text-[#e8eaed] hover:bg-[#303134] transition-colors cursor-pointer"
                aria-expanded={isExpanded}
              >
                <span>{question}</span>
                <span className="text-[#9aa0a6] shrink-0">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3.5 pt-1 text-xs text-[#bdc1c6] font-sans bg-[#202124] border-t border-[#3c4043]/40 space-y-2.5">
                  <p className="leading-relaxed">
                    Search for deeper exploration regarding: <strong className="text-[#e8eaed] font-medium">{question}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(question)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#303134] hover:bg-[#3c4043] border border-[#3c4043] text-xs font-sans text-[#8ab4f8] transition-colors cursor-pointer"
                  >
                    <Search className="w-3 h-3" />
                    <span>Search this question</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
