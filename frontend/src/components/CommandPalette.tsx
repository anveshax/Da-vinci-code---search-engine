import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  FolderCode,
  Globe,
  Sparkles,
  Network,
  Flame,
  Bug,
  CheckCircle2,
  ShieldCheck,
  Shield,
  Bot,
  FileText,
  Settings,
  Volume2,
  VolumeX,
  Code2,
  Briefcase,
  Plus,
  ArrowRight,
  Command,
  Sun,
  Moon,
} from 'lucide-react';
import { ActiveView, SearchMode } from '../types/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ActiveView) => void;
  onSetMode: (mode: SearchMode) => void;
  onNewSearch: () => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
  onToggleTheme?: () => void;
  currentTheme?: 'dark' | 'light';
  onToggleAdaptiveMode?: () => void;
  adaptiveMode?: boolean;
}

interface PaletteAction {
  id: string;
  category: 'Navigation' | 'Search Modes' | 'Preferences';
  title: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  handler: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSetMode,
  onNewSearch,
  onToggleSound,
  soundEnabled,
  onToggleTheme,
  currentTheme,
  onToggleAdaptiveMode,
  adaptiveMode,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions: PaletteAction[] = [
    // Navigation
    {
      id: 'nav-new',
      category: 'Navigation',
      title: 'New AI Search',
      description: 'Start a fresh search conversation',
      icon: <Plus className="w-4 h-4 text-sky-400" />,
      shortcut: 'Ctrl+Shift+N',
      handler: () => {
        onNewSearch();
        onClose();
      },
    },
    {
      id: 'nav-web-intelligence',
      category: 'Navigation',
      title: 'Web Intelligence & Crawler',
      description: 'Autonomous web crawler, domain allowlists, and BM25 search index',
      icon: <Globe className="w-4 h-4 text-cyan-400" />,
      shortcut: 'Alt+3',
      handler: () => {
        onNavigate('web_intelligence');
        onClose();
      },
    },
    {
      id: 'nav-web-studio',
      category: 'Navigation',
      title: 'Web Studio',
      description: 'Multi-agent web development, live sandbox & compiler diagnostics',
      icon: <Code2 className="w-4 h-4 text-emerald-400" />,
      shortcut: 'Alt+2',
      handler: () => {
        onNavigate('web_studio');
        onClose();
      },
    },
    {
      id: 'nav-multi-agent',
      category: 'Navigation',
      title: 'Multi-Agent Governance Core',
      description: 'Orchestrate autonomous specialized agents with policy guardrails',
      icon: <Bot className="w-4 h-4 text-emerald-400" />,
      shortcut: 'Ctrl+Shift+A',
      handler: () => {
        onNavigate('multi_agent');
        onClose();
      },
    },
    {
      id: 'nav-governance',
      category: 'Navigation',
      title: 'Governance Console',
      description: 'Policy guardrails, risk controls, and organizational memory',
      icon: <Shield className="w-4 h-4 text-sky-400" />,
      handler: () => {
        onNavigate('governance');
        onClose();
      },
    },
    {
      id: 'nav-explorer',
      category: 'Navigation',
      title: 'Codebase Explorer',
      description: 'Browse workspace files, symbols, and syntax trees',
      icon: <Code2 className="w-4 h-4 text-sky-400" />,
      handler: () => {
        onNavigate('explorer');
        onClose();
      },
    },
    {
      id: 'nav-deep',
      category: 'Navigation',
      title: 'Deep Research Studio',
      description: 'Run multifaceted multi-step technical investigations',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      handler: () => {
        onNavigate('deep_research');
        onClose();
      },
    },
    {
      id: 'nav-deps',
      category: 'Navigation',
      title: 'Dependency Graph',
      description: 'Visualize module relationships and import trees',
      icon: <Network className="w-4 h-4 text-purple-400" />,
      handler: () => {
        onNavigate('dependencies');
        onClose();
      },
    },
    {
      id: 'nav-impact',
      category: 'Navigation',
      title: 'Change Impact Analysis',
      description: 'Calculate blast radius and affected files before modifying code',
      icon: <Flame className="w-4 h-4 text-rose-400" />,
      handler: () => {
        onNavigate('impact');
        onClose();
      },
    },
    {
      id: 'nav-debug',
      category: 'Navigation',
      title: 'Debugging Assistant',
      description: 'Analyze stack traces, root causes, and verified fixes',
      icon: <Bug className="w-4 h-4 text-emerald-400" />,
      handler: () => {
        onNavigate('debugging');
        onClose();
      },
    },
    {
      id: 'nav-gaps',
      category: 'Navigation',
      title: 'Test Gap Analysis',
      description: 'Detect untested source files and coverage blind spots',
      icon: <CheckCircle2 className="w-4 h-4 text-teal-400" />,
      handler: () => {
        onNavigate('test_gaps');
        onClose();
      },
    },
    {
      id: 'nav-security',
      category: 'Navigation',
      title: 'Security Insights',
      description: 'Inspect hardcoded secrets, injection vectors, and dangerous APIs',
      icon: <ShieldCheck className="w-4 h-4 text-red-400" />,
      handler: () => {
        onNavigate('security');
        onClose();
      },
    },
    {
      id: 'nav-artifacts',
      category: 'Navigation',
      title: 'Saved Artifacts',
      description: 'Browse generated architecture docs and technical specs',
      icon: <FileText className="w-4 h-4 text-sky-400" />,
      handler: () => {
        onNavigate('artifacts');
        onClose();
      },
    },
    {
      id: 'nav-prompts',
      category: 'Navigation',
      title: 'Prompt Library',
      description: 'Exhaustive reusable code review and debugging prompts',
      icon: <Briefcase className="w-4 h-4 text-amber-400" />,
      handler: () => {
        onNavigate('prompts');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      title: 'Platform Settings',
      description: 'Configure AI providers, search engines, and personalization',
      icon: <Settings className="w-4 h-4 text-slate-400" />,
      handler: () => {
        onNavigate('settings');
        onClose();
      },
    },

    // Search Modes
    {
      id: 'mode-auto',
      category: 'Search Modes',
      title: 'Switch Mode: Auto Routing',
      description: 'Intelligently classifies query into codebase or web research',
      icon: <Zap className="w-4 h-4 text-sky-400" />,
      handler: () => {
        onSetMode('auto');
        onClose();
      },
    },
    {
      id: 'mode-code',
      category: 'Search Modes',
      title: 'Switch Mode: Codebase Only',
      description: 'Search repository files, classes, and AST symbols',
      icon: <FolderCode className="w-4 h-4 text-sky-400" />,
      handler: () => {
        onSetMode('code');
        onClose();
      },
    },
    {
      id: 'mode-web',
      category: 'Search Modes',
      title: 'Switch Mode: Web Research',
      description: 'Query live public internet documentation with zero Wikipedia redirect',
      icon: <Globe className="w-4 h-4 text-purple-400" />,
      handler: () => {
        onSetMode('web');
        onClose();
      },
    },
    {
      id: 'mode-deep',
      category: 'Search Modes',
      title: 'Switch Mode: Deep Research',
      description: 'Multi-query breakdown, cross-retrieval, and synthesized report',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      handler: () => {
        onSetMode('deep');
        onClose();
      },
    },

    // Preferences
    {
      id: 'pref-theme',
      category: 'Preferences',
      title: currentTheme === 'dark' ? 'Switch to Solar Glass Theme' : 'Switch to Obsidian Cyber Theme',
      description: currentTheme === 'dark' ? 'Activate crisp high-contrast light theme' : 'Activate deep futuristic dark theme',
      icon: currentTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />,
      shortcut: 'Theme',
      handler: () => {
        if (onToggleTheme) onToggleTheme();
        onClose();
      },
    },
    {
      id: 'pref-adaptive',
      category: 'Preferences',
      title: adaptiveMode ? 'Lock Current Layout (Disable Auto-Adapt)' : 'Enable Adaptive Workspace Engine',
      description: adaptiveMode ? 'Keep interface layout static during searches' : 'Automatically adapt layout to task complexity and intent',
      icon: <Sparkles className="w-4 h-4 text-sky-400" />,
      shortcut: 'Alt+A',
      handler: () => {
        if (onToggleAdaptiveMode) onToggleAdaptiveMode();
        onClose();
      },
    },
    {
      id: 'pref-sound',
      category: 'Preferences',
      title: soundEnabled ? 'Mute Spatial Audio' : 'Enable Spatial Audio',
      description: soundEnabled ? 'Disable synthesized audio feedback' : 'Activate futuristic spatial audio synthesis',
      icon: soundEnabled ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />,
      handler: () => {
        onToggleSound();
        onClose();
      },
    },
  ];

  const filteredActions = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].handler();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-2 sm:px-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-[#090C15] border border-[#1F273C] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Command Input Bar */}
        <div className="flex items-center px-3 sm:px-4 py-3 sm:py-3.5 border-b border-[#1F273C] bg-[#0E1322] shrink-0">
          <Command className="w-5 h-5 text-sky-400 mr-2.5 sm:mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, tool, or search mode..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none font-sans"
          />
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-slate-400 text-[10px] font-mono border border-white/5">
            ESC
          </kbd>
        </div>

        {/* Action Results List */}
        <div className="max-h-[55vh] sm:max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredActions.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              No actions matching "{query}"
            </div>
          ) : (
            filteredActions.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={action.id}
                  onClick={action.handler}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-sky-500/15 border border-sky-400/40 text-white shadow-sm'
                      : 'hover:bg-white/5 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate mr-3">
                    <div className="p-1.5 rounded-lg bg-black/40 border border-white/5 shrink-0">
                      {action.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-white tracking-wide truncate">
                        {action.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {action.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono uppercase text-slate-500 px-1.5 py-0.5 rounded bg-white/5">
                      {action.category}
                    </span>
                    {action.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-400 text-[10px] font-mono">
                        {action.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 text-slate-500 ${isSelected ? 'text-sky-400' : ''}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2 border-t border-[#1F273C] bg-[#070A12] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Execute</span>
            <span>ESC Close</span>
          </div>
          <span>Codebase Intelligence Palette</span>
        </div>
      </div>
    </div>
  );
};
