import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, MicOff, X, SlidersHorizontal, Zap, FolderCode, Globe, Sparkles, Bot, History, ArrowUpRight } from 'lucide-react';
import { SearchMode } from '../types/api';
import { fetchSearchSuggestions } from '../services/api';

// Web Speech API interface
interface IWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SpeechRecognition?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webkitSpeechRecognition?: any;
}

interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
  isSearching: boolean;
  initialQuery?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isSearching,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [searchMode, setSearchMode] = useState<SearchMode>('auto');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('anvesha_recent_searches') || '[]');
    } catch {
      return [];
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveToRecentSearches = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    try {
      const existing: string[] = JSON.parse(localStorage.getItem('anvesha_recent_searches') || '[]');
      const filtered = [clean, ...existing.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
      localStorage.setItem('anvesha_recent_searches', JSON.stringify(filtered));
      setRecentSearches(filtered);
    } catch {}
  };

  // Debounced auto-suggestions with race condition prevention
  useEffect(() => {
    let isCurrent = true;
    const cleanQuery = query.trim();

    if (!cleanQuery || cleanQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetchSearchSuggestions(cleanQuery);
        if (isCurrent) {
          // Guarantee safe array of strings
          const safeStrings = (res || []).map((item) =>
            typeof item === 'string' ? item : (item as any)?.name || (item as any)?.title || String(item ?? '')
          ).filter(Boolean);
          setSuggestions(safeStrings.slice(0, 5));
        }
      } catch {
        if (isCurrent) setSuggestions([]);
      }
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Initialize Web Speech API for voice search
  useEffect(() => {
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setSpeechTranscript(currentText);

        if (finalTranscript) {
          setQuery(finalTranscript);
          setIsListening(false);
          setTimeout(() => {
            onSearch(finalTranscript.trim(), searchMode);
          }, 300);
        }
      };

      recognition.onerror = (event: { error: string }) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone permission denied.');
        } else if (event.error === 'no-speech') {
          setVoiceError('No speech detected.');
        } else {
          setVoiceError(`Voice error: ${event.error}`);
        }
        setTimeout(() => setVoiceError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onSearch, searchMode]);

  const toggleVoice = () => {
    setVoiceError(null);
    if (!recognitionRef.current) {
      setVoiceError('Speech recognition is not supported in this browser.');
      setTimeout(() => setVoiceError(null), 4000);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setSpeechTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  };

  const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 640;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveToRecentSearches(query.trim());
      setIsFocused(false);
      onSearch(query.trim(), searchMode);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSpeechTranscript('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-[640px] flex flex-col items-center">
      <form onSubmit={handleSubmit} className="w-full relative group">
        {/* Luminous Translucent Pill Search Container */}
        <div
          className={`relative flex items-center w-full h-[52px] sm:h-[54px] px-3.5 sm:px-5 rounded-full transition-all duration-300 select-none bg-[#0e1320]/75 backdrop-blur-xl border ${
            isListening
              ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8]/35 shadow-[0_0_28px_rgba(138,180,248,0.3)]'
              : 'border-white/15 hover:border-[#8ab4f8]/45 focus-within:border-[#8ab4f8] shadow-[0_8px_32px_rgba(0,0,0,0.65),0_0_20px_rgba(138,180,248,0.08)] focus-within:shadow-[0_8px_36px_rgba(0,0,0,0.75),0_0_28px_rgba(138,180,248,0.2)]'
          }`}
        >
          {/* Left Magnifier Icon */}
          <button
            type="submit"
            aria-label="Submit Search"
            disabled={isSearching}
            className="flex items-center justify-center text-[#8ab4f8]/80 group-hover:text-[#8ab4f8] hover:text-white transition-colors cursor-pointer mr-2 sm:mr-3 disabled:opacity-50 touch-target"
          >
            {isSearching ? (
              <Search className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse text-[#8ab4f8]" />
            ) : (
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 250)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (query.trim()) {
                  saveToRecentSearches(query.trim());
                  setIsFocused(false);
                  onSearch(query.trim(), searchMode);
                }
              }
            }}
            placeholder={
              isListening
                ? 'Listening... Speak your question'
                : isMobileScreen
                ? 'Search anything...'
                : 'Search anything, code, research, web...'
            }
            className="flex-1 bg-transparent text-[#f8fafc] placeholder-[#8a93a6] text-[16px] font-normal outline-none tracking-normal font-sans min-w-0"
            autoComplete="off"
            autoFocus
          />

          {/* Right Action Icons */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-2 shrink-0">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-full text-[#8a93a6] hover:text-[#f8fafc] hover:bg-white/10 transition-colors touch-target"
                title="Clear input"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Microphone Voice Input */}
            <button
              type="button"
              onClick={toggleVoice}
              aria-label="Voice Search"
              title={isListening ? 'Stop listening' : 'Voice search in English'}
              className={`p-2 rounded-full transition-all touch-target ${
                isListening
                  ? 'bg-[#ea4335] text-white animate-pulse shadow-md'
                  : 'text-[#8a93a6] hover:text-[#f8fafc] hover:bg-white/10'
              }`}
            >
              {isListening ? (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-bounce" />
              ) : (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            {/* Filter / Scope Icon */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              aria-label="Search Scope Filter"
              title="Filter search scope"
              className={`p-2 rounded-full transition-colors touch-target ${
                isFilterOpen || searchMode !== 'auto'
                  ? 'text-[#8ab4f8] bg-[#8ab4f8]/20'
                  : 'text-[#8a93a6] hover:text-[#f8fafc] hover:bg-white/10'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Search Suggestions & Recent Searches Dropdown */}
        {isFocused && (suggestions.length > 0 || recentSearches.length > 0) && (
          <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-40 rounded-2xl bg-[#0c101a]/95 border border-white/10 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(138,180,248,0.08)] p-2 text-xs font-sans space-y-1.5 animate-fade-in text-left max-h-[60vh] overflow-y-auto">
            {suggestions.length > 0 && (
              <div>
                <div className="px-3 py-1 text-[11px] uppercase text-[#8ab4f8] font-medium tracking-wider">
                  Suggestions & Symbols
                </div>
                {suggestions.map((s, idx) => {
                  const label = typeof s === 'string' ? s : (s as any)?.name || (s as any)?.title || String(s ?? '');
                  return (
                    <div
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQuery(label);
                        saveToRecentSearches(label);
                        setIsFocused(false);
                        onSearch(label, searchMode);
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer text-[#f1f5f9] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Search className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />
                        <span className="truncate">{label}</span>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#8a93a6] shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
            {recentSearches.length > 0 && (
              <div className={suggestions.length > 0 ? 'border-t border-white/10 pt-1.5' : ''}>
                <div className="px-3 py-1 text-[11px] uppercase text-[#8a93a6] font-medium tracking-wider flex items-center justify-between">
                  <span>Recent Searches</span>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      localStorage.removeItem('anvesha_recent_searches');
                      setRecentSearches([]);
                    }}
                    className="text-[10px] text-[#8a93a6] hover:text-[#f8fafc] normal-case"
                  >
                    Clear All
                  </button>
                </div>
                {recentSearches.map((r, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setQuery(r);
                      saveToRecentSearches(r);
                      setIsFocused(false);
                      onSearch(r, searchMode);
                    }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-white/5 cursor-pointer text-[#bdc1c6] hover:text-[#f8fafc] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <History className="w-3.5 h-3.5 text-[#8a93a6] shrink-0" />
                      <span className="truncate">{r}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Search Mode Selection Pills (Google-style immediate intent routing) */}
      <div className="mt-3.5 sm:mt-4 w-full flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap pointer-events-auto px-1">
        {[
          { id: 'auto' as SearchMode, label: 'Auto', icon: Zap, activeColor: 'text-[#8ab4f8]' },
          { id: 'code' as SearchMode, label: 'Codebase', icon: FolderCode, activeColor: 'text-[#8ab4f8]' },
          { id: 'web' as SearchMode, label: 'Web', icon: Globe, activeColor: 'text-[#8ab4f8]' },
          { id: 'deep' as SearchMode, label: 'Deep Research', icon: Sparkles, activeColor: 'text-amber-400' },
          { id: 'direct' as SearchMode, label: 'Direct AI', icon: Bot, activeColor: 'text-emerald-400' },
        ].map((m) => {
          const isSelected = searchMode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSearchMode(m.id);
                setIsFilterOpen(false);
              }}
              className={`px-3 py-1.5 min-h-[38px] rounded-full text-xs font-sans transition-all flex items-center gap-1.5 border touch-target ${
                isSelected
                  ? 'bg-[#8ab4f8]/20 border-[#8ab4f8]/50 text-white font-medium shadow-[0_0_12px_rgba(138,180,248,0.25)]'
                  : 'bg-white/[0.04] border-white/10 text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-white/[0.08]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? m.activeColor : 'text-[#9aa0a6]'}`} />
              <span className="whitespace-nowrap">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Voice Transcript / Error Toast */}
      {isListening && (
        <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-sans text-[#8ab4f8] animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[#8ab4f8] animate-ping" />
          <span>{speechTranscript ? `"${speechTranscript}"` : 'Listening in English...'}</span>
        </div>
      )}

      {voiceError && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-sans text-rose-300 bg-rose-950/40 py-1 px-3 rounded-full border border-rose-500/30">
          <MicOff className="w-3.5 h-3.5" />
          <span>{voiceError}</span>
        </div>
      )}

      {/* Scope Selector Popover when Filter Icon is clicked */}
      {isFilterOpen && (
        <div className="absolute top-[60px] right-0 z-30 w-72 max-w-[calc(100vw-2rem)] bg-[#0c101a]/95 border border-white/10 backdrop-blur-2xl rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(138,180,248,0.08)] p-2 animate-fade-in text-xs font-sans">
          <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#8a93a6] border-b border-white/10 mb-1">
            Search Mode
          </div>
          <button
            type="button"
            onClick={() => { setSearchMode('auto'); setIsFilterOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left transition-colors ${searchMode === 'auto' ? 'bg-[#8ab4f8]/15 text-[#8ab4f8] font-medium' : 'text-[#f1f5f9] hover:bg-white/5'}`}
          >
            <Zap className="w-4 h-4 text-[#8ab4f8] shrink-0" />
            <div>
              <div className="font-semibold">Auto Route</div>
              <div className="text-[11px] text-[#8a93a6]">Classifies intent automatically</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setSearchMode('code'); setIsFilterOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left transition-colors ${searchMode === 'code' ? 'bg-[#8ab4f8]/15 text-[#8ab4f8] font-medium' : 'text-[#f1f5f9] hover:bg-white/5'}`}
          >
            <FolderCode className="w-4 h-4 text-[#8ab4f8] shrink-0" />
            <div>
              <div className="font-semibold">Codebase</div>
              <div className="text-[11px] text-[#8a93a6]">Indexed repository & AST symbols</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setSearchMode('web'); setIsFilterOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left transition-colors ${searchMode === 'web' ? 'bg-[#8ab4f8]/15 text-[#8ab4f8] font-medium' : 'text-[#f1f5f9] hover:bg-white/5'}`}
          >
            <Globe className="w-4 h-4 text-[#8ab4f8] shrink-0" />
            <div>
              <div className="font-semibold">Web Research</div>
              <div className="text-[11px] text-[#8a93a6]">Live internet search & documentation</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setSearchMode('deep'); setIsFilterOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left transition-colors ${searchMode === 'deep' ? 'bg-amber-400/15 text-amber-300 font-medium' : 'text-[#f1f5f9] hover:bg-white/5'}`}
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <div>
              <div className="font-semibold">Deep Research</div>
              <div className="text-[11px] text-[#8a93a6]">Multi-step retrieval & synthesis</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setSearchMode('direct'); setIsFilterOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left transition-colors ${searchMode === 'direct' ? 'bg-emerald-400/15 text-emerald-300 font-medium' : 'text-[#f1f5f9] hover:bg-white/5'}`}
          >
            <Bot className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="font-semibold">Direct AI</div>
              <div className="text-[11px] text-[#8a93a6]">Pure model reasoning without live web retrieval</div>
            </div>
          </button>
        </div>
      )}

      {/* Luminous Integrated Search Mode Selectors */}
      <div className="mt-3 sm:mt-3.5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 select-none px-1">
        <button
          type="button"
          onClick={() => setSearchMode('auto')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all border ${
            searchMode === 'auto'
              ? 'bg-[#8ab4f8]/15 backdrop-blur-md text-[#8ab4f8] border-[#8ab4f8]/40 font-medium shadow-[0_0_12px_rgba(138,180,248,0.2)]'
              : 'bg-[#0e1320]/50 backdrop-blur-md text-[#8a93a6] border-white/10 hover:bg-[#0e1320]/80 hover:text-[#f8fafc] hover:border-white/20'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[#8ab4f8]" />
          <span>Auto</span>
        </button>
        <button
          type="button"
          onClick={() => setSearchMode('code')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all border ${
            searchMode === 'code'
              ? 'bg-[#8ab4f8]/15 backdrop-blur-md text-[#8ab4f8] border-[#8ab4f8]/40 font-medium shadow-[0_0_12px_rgba(138,180,248,0.2)]'
              : 'bg-[#0e1320]/50 backdrop-blur-md text-[#8a93a6] border-white/10 hover:bg-[#0e1320]/80 hover:text-[#f8fafc] hover:border-white/20'
          }`}
        >
          <FolderCode className="w-3.5 h-3.5 text-[#8ab4f8]" />
          <span>Codebase</span>
        </button>
        <button
          type="button"
          onClick={() => setSearchMode('web')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all border ${
            searchMode === 'web'
              ? 'bg-[#8ab4f8]/15 backdrop-blur-md text-[#8ab4f8] border-[#8ab4f8]/40 font-medium shadow-[0_0_12px_rgba(138,180,248,0.2)]'
              : 'bg-[#0e1320]/50 backdrop-blur-md text-[#8a93a6] border-white/10 hover:bg-[#0e1320]/80 hover:text-[#f8fafc] hover:border-white/20'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-[#8ab4f8]" />
          <span>Web</span>
        </button>
        <button
          type="button"
          onClick={() => setSearchMode('deep')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all border ${
            searchMode === 'deep'
              ? 'bg-amber-400/15 backdrop-blur-md text-amber-300 border-amber-400/40 font-medium shadow-[0_0_12px_rgba(251,191,36,0.18)]'
              : 'bg-[#0e1320]/50 backdrop-blur-md text-[#8a93a6] border-white/10 hover:bg-[#0e1320]/80 hover:text-[#f8fafc] hover:border-white/20'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Deep Research</span>
        </button>
        <button
          type="button"
          onClick={() => setSearchMode('direct')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all border ${
            searchMode === 'direct'
              ? 'bg-emerald-400/15 backdrop-blur-md text-emerald-300 border-emerald-400/40 font-medium shadow-[0_0_12px_rgba(52,211,153,0.18)]'
              : 'bg-[#0e1320]/50 backdrop-blur-md text-[#8a93a6] border-white/10 hover:bg-[#0e1320]/80 hover:text-[#f8fafc] hover:border-white/20'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-emerald-400" />
          <span>Direct AI</span>
        </button>
      </div>
    </div>
  );
};
