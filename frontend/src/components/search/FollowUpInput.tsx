import React, { useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface FollowUpInputProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

export const FollowUpInput: React.FC<FollowUpInputProps> = ({
  onSubmit,
  disabled = false,
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-3 border-t border-[#3c4043] flex items-center gap-2">
      <div className="relative flex-1 flex items-center bg-[#202124] border border-[#3c4043] focus-within:border-[#8ab4f8] rounded-full px-4 py-1.5 transition-colors">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask anything..."
          disabled={disabled}
          className="w-full bg-transparent text-sm text-[#e8eaed] placeholder-[#9aa0a6] outline-none disabled:opacity-50 font-sans"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="p-1.5 rounded-full bg-[#8ab4f8] hover:bg-[#8ab4f8]/90 disabled:opacity-30 disabled:cursor-not-allowed text-[#202124] transition-all shrink-0"
          title="Submit follow-up question"
          aria-label="Send follow-up"
        >
          <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </form>
  );
};
