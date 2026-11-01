import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  FileDown,
  Bookmark,
  Check,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { streamSearchV2, createArtifact } from '../services/api';
import { SSEEvent, SearchResultItem, WebSearchResultItem, CitationItem } from '../types/api';
import { MarkdownRenderer } from './MarkdownRenderer';

export const DeepResearchWorkspace: React.FC = () => {
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<'standard' | 'exhaustive'>('standard');
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [reportText, setReportText] = useState('');
  const [citations, setCitations] = useState<CitationItem[]>([]);
  const [codeResults, setCodeResults] = useState<SearchResultItem[]>([]);
  const [webResults, setWebResults] = useState<WebSearchResultItem[]>([]);
  const [savedArtifact, setSavedArtifact] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartResearch = async () => {
    if (!query.trim() || isRunning) return;

    setIsRunning(true);
    setError(null);
    setReportText('');
    setCitations([]);
    setStatusMessage('Phase 1/4: Analyzing inquiry & formulating research vectors...');

    let accumulated = '';

    try {
      await streamSearchV2(
        query.trim(),
        'deep',
        [],
        (event: SSEEvent) => {
          switch (event.event) {
            case 'status':
              setStatusMessage(event.data.message);
              break;
            case 'sources':
              setCodeResults(event.data.code_results || []);
              setWebResults(event.data.web_results || []);
              break;
            case 'citations':
              setCitations(event.data || []);
              break;
            case 'answer_chunk':
              accumulated += event.data.delta;
              setReportText(accumulated);
              break;
            case 'completed':
              setIsRunning(false);
              setStatusMessage('');
              break;
            case 'error':
              setError(event.data.message);
              setIsRunning(false);
              break;
          }
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deep research failed');
      setIsRunning(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveAsArtifact = async () => {
    if (!reportText) return;
    try {
      await createArtifact(
        `Research: ${query.slice(0, 50)}`,
        reportText,
        'research_report',
        'markdown'
      );
      setSavedArtifact(true);
      setTimeout(() => setSavedArtifact(false), 2500);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-6 max-w-5xl mx-auto w-full pb-safe">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0C1222] via-[#0D1528] to-[#0A0E1A] border border-[#1F273C] shadow-xl space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Deep Research & Investigation Studio
            </h2>
            <p className="text-xs text-slate-400">
              Multifaceted retrieval breaking questions into subqueries, cross-checking code and live web evidence.
            </p>
          </div>
        </div>

        {/* Query Input Box */}
        <div className="space-y-3 pt-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe your technical inquiry in detail (e.g. 'Investigate the authentication architecture, security boundary risks, and compare with OAuth2 best practices')..."
            rows={3}
            className="w-full p-3.5 rounded-xl bg-[#070A12] border border-[#232B3E] focus:border-amber-400/80 text-xs font-mono text-white placeholder-slate-500 outline-none resize-none"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Research depth options */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono flex-wrap">
              <span className="text-slate-400 text-[11px]">Depth:</span>
              <button
                onClick={() => setDepth('standard')}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg transition-colors ${
                  depth === 'standard'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                Standard (Fast)
              </button>
              <button
                onClick={() => setDepth('exhaustive')}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg transition-colors ${
                  depth === 'exhaustive'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white bg-white/5'
                }`}
              >
                Exhaustive (Deep Context)
              </button>
            </div>

            <button
              onClick={handleStartResearch}
              disabled={isRunning || !query.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-semibold text-xs font-mono transition-all shadow-md shadow-amber-400/20"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Investigating...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Execute Deep Research</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Status Card */}
      {isRunning && (
        <div className="p-4 rounded-xl bg-[#0A0E1C] border border-amber-500/30 text-xs font-mono space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-amber-300 font-semibold uppercase tracking-wider">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Research Pipeline In Progress</span>
          </div>
          <div className="text-slate-300 pl-6 border-l-2 border-amber-400">
            {statusMessage}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={handleStartResearch}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 text-xs font-mono"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Structured Research Report Output */}
      {reportText && (
        <div className="p-6 rounded-2xl bg-[#090C16] border border-[#1E2638] shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Structured Research Report
              </h3>
              <div className="text-[10px] font-mono text-slate-500">
                Grounding evidence: {codeResults.length} code references &bull; {webResults.length} web sources
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveAsArtifact}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                title="Save as persistent project artifact"
              >
                {savedArtifact ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
                <span>{savedArtifact ? 'Saved!' : 'Save Artifact'}</span>
              </button>

              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                title="Download Markdown report"
              >
                <FileDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Export Markdown</span>
              </button>
            </div>
          </div>

          {/* Report Body */}
          <div className="text-sm text-slate-200">
            <MarkdownRenderer content={reportText} />
          </div>

          {/* Verified Evidence Footer */}
          {citations.length > 0 && (
            <div className="pt-4 border-t border-white/5 space-y-2">
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified Evidence Sources ({citations.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {citations.map((c, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-[#0F1424] border border-[#1E2638] truncate">
                    <span className="font-bold text-slate-200 truncate block">{c.title}</span>
                    <span className="text-[10px] text-slate-500 truncate block">
                      {c.type === 'code' ? `Line ${c.line_number}` : c.domain}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
