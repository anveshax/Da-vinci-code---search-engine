import React, { useState } from 'react';
import {
  X,
  Send,
  Loader2,
  Cpu,
} from 'lucide-react';
import { runModelComparison } from '../services/api';
import { ModelCompareResult } from '../types/api';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ModelCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const ModelCompareModal: React.FC<ModelCompareModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [modelA, setModelA] = useState('llama-3.3-70b-versatile');
  const [modelB, setModelB] = useState('llama-3.1-8b-instant');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ModelCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCompare = async () => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await runModelComparison(query.trim(), modelA, modelB);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model comparison failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-[#090C16] border border-[#1E2638] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-[#1E2638] px-6 flex items-center justify-between bg-[#0C1220]">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Dual Model Comparison Studio
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input & Model Selector */}
        <div className="p-5 border-b border-white/5 space-y-3 bg-[#0B0F1A]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Model A:</label>
              <input
                type="text"
                value={modelA}
                onChange={(e) => setModelA(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#070A12] border border-[#232B3E] text-xs font-mono text-white outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">Model B:</label>
              <input
                type="text"
                value={modelB}
                onChange={(e) => setModelB(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[#070A12] border border-[#232B3E] text-xs font-mono text-white outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a technical or architectural question to evaluate both models..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#070A12] border border-[#232B3E] text-xs font-mono text-white outline-none focus:border-sky-400"
            />
            <button
              onClick={handleCompare}
              disabled={isLoading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-black font-semibold text-xs font-mono transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Compare</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/30 text-rose-300 text-xs font-mono text-center border-b border-rose-900/40">
            {error}
          </div>
        )}

        {/* Side-by-side Response Canvas */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {result ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Model A Column */}
              <div className="p-5 rounded-2xl bg-[#0B0F1C] border border-[#1E273A] space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="font-bold text-xs font-mono text-sky-400">{result.model_a.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">{result.model_a.latency_ms}ms</span>
                </div>
                <div className="text-xs text-slate-300">
                  <MarkdownRenderer content={result.model_a.response} />
                </div>
              </div>

              {/* Model B Column */}
              <div className="p-5 rounded-2xl bg-[#0B0F1C] border border-[#1E273A] space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="font-bold text-xs font-mono text-amber-400">{result.model_b.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">{result.model_b.latency_ms}ms</span>
                </div>
                <div className="text-xs text-slate-300">
                  <MarkdownRenderer content={result.model_b.response} />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs font-mono text-slate-500">
              Submit an evaluation query to compare inference quality, structure, and latency side-by-side.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
