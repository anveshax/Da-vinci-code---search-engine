import React from 'react';
import {
  Layers,
  X,
  FileCode,
  Globe,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { SearchResultItem, WebSearchResultItem, ChatMessage } from '../types/api';

interface AIContextInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  codeSnippets: SearchResultItem[];
  onRemoveCodeSnippet: (index: number) => void;
  webSources: WebSearchResultItem[];
  onRemoveWebSource: (index: number) => void;
  conversationHistory: ChatMessage[];
  onClearHistory: () => void;
}

export const AIContextInspectorModal: React.FC<AIContextInspectorModalProps> = ({
  isOpen,
  onClose,
  codeSnippets,
  onRemoveCodeSnippet,
  webSources,
  onRemoveWebSource,
  conversationHistory,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  const totalTokensEstimated =
    codeSnippets.reduce((acc, c) => acc + Math.round(c.snippet.length / 4), 0) +
    webSources.reduce((acc, w) => acc + Math.round(w.snippet.length / 4), 0) +
    conversationHistory.reduce((acc, m) => acc + Math.round(m.content.length / 4), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] bg-[#090C16] border border-[#1E2638] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-[#1E2638] px-6 flex items-center justify-between bg-[#0C1220]">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Live AI Prompt Context Inspector
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              Est. Context: <strong className="text-sky-300">~{totalTokensEstimated} tokens</strong>
            </span>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Section 1: Codebase Snippets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-sky-400" />
                <span>Retrieved Code Snippets ({codeSnippets.length})</span>
              </span>
            </div>

            {codeSnippets.length === 0 ? (
              <div className="p-3 rounded-lg bg-[#070A12] border border-white/5 text-xs text-slate-500 font-mono">
                No local code snippets included in context.
              </div>
            ) : (
              <div className="space-y-2">
                {codeSnippets.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#0B0F1A] border border-[#1C2538] flex items-start justify-between gap-3 text-xs font-mono"
                  >
                    <div className="truncate flex-1">
                      <div className="font-bold text-white truncate mb-1">
                        {c.relative_path}:{c.line_number}
                        {c.symbol_name && (
                          <span className="ml-2 text-purple-400 font-normal">
                            ({c.symbol_name})
                          </span>
                        )}
                      </div>
                      <code className="text-slate-400 block truncate bg-black/40 p-1.5 rounded">
                        {c.snippet}
                      </code>
                    </div>
                    <button
                      onClick={() => onRemoveCodeSnippet(idx)}
                      className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Remove from context"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Web Research Sources */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>Web Evidence Sources ({webSources.length})</span>
              </span>
            </div>

            {webSources.length === 0 ? (
              <div className="p-3 rounded-lg bg-[#070A12] border border-white/5 text-xs text-slate-500 font-mono">
                No web sources included in context.
              </div>
            ) : (
              <div className="space-y-2">
                {webSources.map((w, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#0B0F1A] border border-[#1C2538] flex items-start justify-between gap-3 text-xs font-mono"
                  >
                    <div className="truncate flex-1">
                      <div className="font-bold text-white truncate mb-1">{w.title}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 font-sans">
                        {w.snippet}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemoveWebSource(idx)}
                      className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Remove from context"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Conversation History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Conversation Turns ({conversationHistory.length})</span>
              </span>
              {conversationHistory.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-[11px] font-mono text-rose-400 hover:underline"
                >
                  Clear History
                </button>
              )}
            </div>

            {conversationHistory.length === 0 ? (
              <div className="p-3 rounded-lg bg-[#070A12] border border-white/5 text-xs text-slate-500 font-mono">
                No prior turns in context.
              </div>
            ) : (
              <div className="space-y-1.5">
                {conversationHistory.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-[#0B0F1A] border border-[#1C2538] text-xs font-mono"
                  >
                    <span className="text-sky-400 uppercase font-bold mr-2">[{m.role}]:</span>
                    <span className="text-slate-300 line-clamp-1">{m.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
