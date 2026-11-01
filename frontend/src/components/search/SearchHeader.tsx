import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Mic,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  Volume2,
  VolumeX,
  ArrowLeft,
  Settings
} from 'lucide-react';
import { SearchMode } from '../../types/api';

interface SearchHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: (query: string, mode?: SearchMode) => void;
  onClear: () => void;
  onBackToSearch: () => void;
  currentMode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  isStreaming?: boolean;
  isListeningVoice: boolean;
  onToggleVoice: () => void;
  suggestions: string[];
  showSuggestions: boolean;
  onSelectSuggestion: (sugg: string) => void;
  onCloseSuggestions?: () => void;
  isSpeaking?: boolean;
  onToggleSpeech?: () => void;
  onOpenSettings?: () => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  query,
  onQueryChange,
  onSubmit,
  onClear,
  onBackToSearch,
  currentMode,
  onModeChange,
  isListeningVoice,
  onToggleVoice,
  suggestions,
  showSuggestions,
  onSelectSuggestion,
  isSpeaking,
  onToggleSpeech,
  onOpenSettings,
}) => {
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query.trim(), currentMode);
    }
  };

  const modeLabels: Record<SearchMode, string> = {
    auto: 'All / Auto',
    web: 'Web Mode',
    code: 'Code Mode',
    deep: 'Deep Research',
    direct: 'Direct AI',
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#202124] border-b border-[#3c4043] px-2.5 sm:px-6 py-2 sm:py-3 transition-colors pt-safe">
      <div className="max-w-[1240px] mx-auto flex items-center justify-between gap-2 sm:gap-6">
        {/* Left: Brand Logo & Wordmark */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onBackToSearch}
            className="p-2 rounded-full hover:bg-[#303134] text-[#bdc1c6] hover:text-[#e8eaed] transition-colors touch-target"
            title="Return to search home"
            aria-label="Back to search"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onBackToSearch}
            className="flex items-center gap-2 group text-left cursor-pointer touch-target"
            aria-label="ANVESHA Home"
          >
            <div className="w-7 h-7 rounded-lg bg-[#303134] border border-[#3c4043] flex items-center justify-center text-[#8ab4f8] group-hover:border-[#8ab4f8] transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline font-sans font-semibold tracking-wide text-base sm:text-lg text-[#e8eaed]">
              ANVESHA
            </span>
          </button>
        </div>

        {/* Center: Google-Style Search Bar */}
        <div className="flex-1 max-w-[692px] relative min-w-0">
          <form onSubmit={handleSubmit} className="relative flex items-center w-full">
            <div className="relative flex-1 flex items-center bg-[#303134] hover:bg-[#303134] focus-within:bg-[#303134] border border-[#3c4043] hover:border-[#5f6368] focus-within:border-[#8ab4f8] rounded-full shadow-sm hover:shadow-md focus-within:shadow-md transition-all min-h-[42px] sm:min-h-[46px]">
              <button
                type="submit"
                aria-label="Search"
                className="pl-3 sm:pl-4 pr-1.5 sm:pr-2 text-[#9aa0a6] hover:text-[#8ab4f8] transition-colors touch-target"
              >
                <Search className="w-4 h-4" />
              </button>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search anything..."
                className="w-full py-2 sm:py-2.5 pr-2 bg-transparent text-[16px] sm:text-sm text-[#e8eaed] placeholder-[#9aa0a6] outline-none font-sans"
                autoComplete="off"
              />

              {/* Action Controls Inside Input */}
              <div className="flex items-center pr-2 sm:pr-3 gap-0.5 sm:gap-1">
                {query && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="p-1.5 rounded-full text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043] transition-colors touch-target"
                    title="Clear search"
                    aria-label="Clear input"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <div className="w-[1px] h-4 sm:h-5 bg-[#3c4043] mx-0.5 sm:mx-1" />

                <button
                  type="button"
                  onClick={onToggleVoice}
                  className={`p-1.5 sm:p-2 rounded-full transition-colors touch-target ${
                    isListeningVoice
                      ? 'bg-red-500/20 text-red-400 animate-pulse'
                      : 'text-[#9aa0a6] hover:text-[#8ab4f8] hover:bg-[#3c4043]'
                  }`}
                  title={isListeningVoice ? 'Listening...' : 'Search by voice'}
                  aria-label="Voice search"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1.5 w-full bg-[#303134] border border-[#3c4043] rounded-2xl shadow-2xl overflow-hidden z-50 divide-y divide-[#3c4043] max-h-60 overflow-y-auto">
              {suggestions.map((sugg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSuggestion(sugg)}
                  className="w-full px-4 py-2.5 min-h-[44px] text-left text-sm font-sans text-[#bdc1c6] hover:text-[#e8eaed] hover:bg-[#3c4043] flex items-center gap-3 transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-[#9aa0a6] shrink-0" />
                  <span className="truncate">{sugg}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Subtle Controls (Mode Dropdown, Audio Readout, Settings) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Search Mode Selector (Responsive: compact pill on mobile, expanded on desktop) */}
          <div className="relative" ref={modeDropdownRef}>
            <button
              type="button"
              onClick={() => setIsModeDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#303134] hover:bg-[#3c4043] border border-[#3c4043] text-xs text-[#bdc1c6] hover:text-[#e8eaed] transition-colors min-h-[38px]"
              title="Change search mode"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8ab4f8]" />
              <span className="font-medium hidden md:inline">{modeLabels[currentMode]}</span>
              <ChevronDown className="w-3 h-3 text-[#9aa0a6]" />
            </button>

            {isModeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 max-w-[calc(100vw-2rem)] bg-[#303134] border border-[#3c4043] rounded-xl shadow-xl py-1 z-50">
                {(['auto', 'web', 'code', 'deep', 'direct'] as SearchMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onModeChange(m);
                      setIsModeDropdownOpen(false);
                      if (query.trim()) onSubmit(query.trim(), m);
                    }}
                    className={`w-full px-3 py-2.5 min-h-[40px] text-left text-xs flex items-center justify-between transition-colors ${
                      currentMode === m
                        ? 'bg-[#3c4043] text-[#8ab4f8] font-semibold'
                        : 'text-[#bdc1c6] hover:text-[#e8eaed] hover:bg-[#3c4043]'
                    }`}
                  >
                    <span>{modeLabels[m]}</span>
                    {currentMode === m && <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Audio TTS Read-aloud button if speaking */}
          {onToggleSpeech && (
            <button
              type="button"
              onClick={onToggleSpeech}
              className={`p-2 rounded-full transition-colors touch-target ${
                isSpeaking
                  ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134]'
              }`}
              title={isSpeaking ? 'Stop speaking' : 'Read answer aloud'}
              aria-label="Text to speech"
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Settings modal button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 rounded-full text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134] transition-colors touch-target"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
