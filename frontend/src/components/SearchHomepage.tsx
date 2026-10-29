import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Mic,
  MicOff,
  X,
  Sparkles,
  Sliders,
  LayoutDashboard,
  Cpu,
  Layers,
  FileCode2,
  Zap,
  FolderCode,
  Globe
} from 'lucide-react';
import { ThreeSphere } from './ThreeSphere';
import { SearchMode } from '../types/api';

// Type definitions for Web Speech API
interface IWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SpeechRecognition?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webkitSpeechRecognition?: any;
}

interface SearchHomepageProps {
  onSearch: (query: string, mode: SearchMode) => void;
  isSearching: boolean;
  onOpenDashboard: () => void;
  workspacePath?: string;
}

export const SearchHomepage: React.FC<SearchHomepageProps> = ({
  onSearch,
  isSearching,
  onOpenDashboard,
  workspacePath,
}) => {
  const [query, setQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<SearchMode>('auto');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechTranscript, setSpeechTranscript] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition once
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
          // Automatically trigger search when user finishes speaking
          setTimeout(() => {
            onSearch(finalTranscript.trim(), searchMode);
          }, 300);
        }
      };

      recognition.onerror = (event: { error: string }) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone permission was denied. Please allow microphone access in your browser.');
        } else if (event.error === 'no-speech') {
          setVoiceError('No speech detected. Please speak clearly into the microphone.');
        } else {
          setVoiceError(`Voice input error: ${event.error}`);
        }
        setTimeout(() => setVoiceError(null), 5000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [onSearch]);

  const toggleVoiceSearch = () => {
    setVoiceError(null);
    if (!recognitionRef.current) {
      setVoiceError('Speech recognition is not supported in this browser. Please type your query.');
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), searchMode);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSpeechTranscript('');
  };

  const suggestedQueries = [
    'FastAPI',
    'CodebaseScanner',
    'health',
    'ThreeSphere',
    'def get_health',
  ];

  return (
    <div className="relative min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-cyber-cyan/30 selection:text-cyber-cyanGlow overflow-x-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-cyber-cyan" />
          </div>
          <span className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
            CIE &bull; Studio
          </span>
        </div>

        {/* Right Nav: Switch to Full Studio Workspace */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReducedMotion(!reducedMotion)}
            title="Toggle lightweight 3D animation mode for older hardware"
            className={`p-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all ${
              reducedMotion
                ? 'bg-amber-950/40 border border-amber-500/40 text-amber-300'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {reducedMotion ? 'Eco 3D: ON' : 'Eco 3D'}
            </span>
          </button>

          <button
            onClick={onOpenDashboard}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 hover:text-white transition-all shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4 text-cyber-violet" />
            <span>Studio Workspace</span>
          </button>
        </div>
      </header>

      {/* Center Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-6 sm:-mt-8 z-10 w-full max-w-4xl mx-auto text-center">
        {/* Product Brand Title Above Sphere */}
        <div className="space-y-1 mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>Autonomous Code Intelligence</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white uppercase font-mono mt-3">
            Codebase Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-mono tracking-tight max-w-lg mx-auto">
            Minimalist semantic search & real-time AST exploration engine
          </p>
        </div>

        {/* 3D Animated Sphere Canvas */}
        <div className="relative w-full max-w-[500px] flex items-center justify-center my-[-20px] sm:my-[-30px]">
          <ThreeSphere isSearching={isSearching} reducedMotion={reducedMotion} />
        </div>

        {/* Minimalist Rounded Search Bar */}
        <div className="w-full max-w-2xl px-2">
          {/* Manual Routing Selector: [Auto | Codebase | Web] */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSearchMode('auto')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all ${
                searchMode === 'auto'
                  ? 'bg-cyber-cyan/15 border border-cyber-cyan text-cyber-cyan font-semibold shadow-sm shadow-cyber-cyan/20'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Zap className="w-3 h-3 text-cyber-cyan" />
              <span>Auto</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchMode('code')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all ${
                searchMode === 'code'
                  ? 'bg-cyber-cyan/15 border border-cyber-cyan text-cyber-cyan font-semibold shadow-sm shadow-cyber-cyan/20'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 text-slate-400 hover:text-slate-300'
              }`}
            >
              <FolderCode className="w-3 h-3 text-cyber-cyan" />
              <span>Codebase</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchMode('web')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all ${
                searchMode === 'web'
                  ? 'bg-cyber-violet/20 border border-cyber-violet text-cyber-violetGlow font-semibold shadow-sm shadow-cyber-violet/20'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 text-slate-400 hover:text-slate-300'
              }`}
            >
              <Globe className="w-3 h-3 text-cyber-violet" />
              <span>Web Research</span>
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="relative group">
            <div className={`relative flex items-center w-full rounded-full transition-all duration-300 ${
              isListening
                ? 'bg-[#101726] ring-2 ring-cyber-cyan shadow-xl shadow-cyber-cyan/20 border-transparent'
                : 'bg-[#111622]/90 hover:bg-[#141B2B] focus-within:bg-[#141B2B] border border-[#232B3E] focus-within:border-cyber-cyan focus-within:ring-1 focus-within:ring-cyber-cyan shadow-lg shadow-black/60'
            }`}>
              {/* Search Submit Button */}
              <button
                type="submit"
                aria-label="Submit search"
                className="pl-5 pr-2 flex items-center justify-center text-slate-400 hover:text-cyber-cyan focus:text-cyber-cyan group-focus-within:text-cyber-cyan transition-colors cursor-pointer"
                title="Search codebase"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Text Input Field */}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (query.trim()) {
                      onSearch(query.trim(), searchMode);
                    }
                  }
                }}
                placeholder={
                  isListening
                    ? 'Listening... Speak your search query'
                    : searchMode === 'code'
                    ? 'Search functions, classes, symbols, or files...'
                    : searchMode === 'web'
                    ? 'Search documentation, guides, or public tech...'
                    : 'Search codebase symbols or ask a technical question...'
                }
                className="w-full py-4 pr-3 text-sm font-mono text-white placeholder-slate-500 bg-transparent outline-none tracking-wide"
                autoComplete="off"
                autoFocus
              />

              {/* Right Controls: Clear & Microphone */}
              <div className="pr-4 flex items-center gap-2">
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* English Voice Search Button */}
                <button
                  type="button"
                  onClick={toggleVoiceSearch}
                  className={`p-2.5 rounded-full transition-all relative ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/50'
                      : 'text-slate-400 hover:text-cyber-cyan hover:bg-white/5'
                  }`}
                  title={isListening ? 'Stop listening' : 'Search with English voice'}
                >
                  {isListening ? (
                    <Mic className="w-4 h-4 text-white animate-bounce" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Voice Transcript / Error Feedback Bar */}
          {isListening && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-cyber-cyan animate-pulse">
              <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-ping" />
              <span>{speechTranscript ? `"${speechTranscript}"` : 'Listening in English... Speak now'}</span>
            </div>
          )}

          {voiceError && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-rose-400 bg-rose-950/40 py-1.5 px-3 rounded-lg border border-rose-500/30">
              <MicOff className="w-3.5 h-3.5" />
              <span>{voiceError}</span>
            </div>
          )}

          {/* Suggested Quick Queries */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
            <span className="text-slate-500 text-[11px]">Popular terms:</span>
            {suggestedQueries.map((term) => (
              <button
                key={term}
                onClick={() => {
                  setQuery(term);
                  onSearch(term, searchMode);
                }}
                className="px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyber-cyan/40 text-slate-400 hover:text-cyber-cyan transition-all text-[11px]"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500 border-t border-white/[0.05] z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyber-cyan" />
            <span>Real Local AST Ingestion</span>
          </span>
          <span className="hidden sm:inline text-slate-700">&bull;</span>
          <span className="hidden sm:flex items-center gap-1.5">
            <FileCode2 className="w-3.5 h-3.5 text-cyber-violet" />
            <span>Pure Black Workspace</span>
          </span>
        </div>

        <div className="text-slate-500 text-center sm:text-right">
          {workspacePath ? (
            <span className="truncate max-w-[320px] inline-block">
              Root: {workspacePath.split('/').pop()}
            </span>
          ) : (
            <span>Codebase Intelligence Engine &bull; Minimalist Search</span>
          )}
        </div>
      </footer>
    </div>
  );
};
