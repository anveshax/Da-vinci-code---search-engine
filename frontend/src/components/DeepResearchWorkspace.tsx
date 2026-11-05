import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  FileDown,
  AlertCircle,
  RotateCcw,
  BookOpen,
  Trash2,
  Printer,
  Scale,
  ChevronRight,
} from 'lucide-react';
import { streamSearchV2, fetchResearchReports, deleteResearchReport } from '../services/api';
import { SSEEvent, SearchResultItem, WebSearchResultItem, ResearchReport, ResearchDepth } from '../types/api';
import { MarkdownRenderer } from './MarkdownRenderer';

export const DeepResearchWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'investigate' | 'library'>('investigate');
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<ResearchDepth>('deep');
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [reportText, setReportText] = useState('');
  const [codeResults, setCodeResults] = useState<SearchResultItem[]>([]);
  const [webResults, setWebResults] = useState<WebSearchResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reports Library State
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ResearchReport | null>(null);

  const loadReports = async () => {
    try {
      const data = await fetchResearchReports();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'library') {
      loadReports();
    }
  }, [activeTab]);

  const handleStartResearch = async () => {
    if (!query.trim() || isRunning) return;

    setIsRunning(true);
    setError(null);
    setReportText('');
    setStatusMessage('Decomposing query across research angles (Quick: 2, Deep: 4, Extended: 6)...');

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
              break;
            case 'answer_chunk':
              accumulated += event.data.delta;
              setReportText(accumulated);
              break;
            case 'completed':
              setIsRunning(false);
              setStatusMessage('');
              loadReports();
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

  const handleExportMarkdown = (text: string, title: string = 'research-report') => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteResearchReport(id);
    if (selectedReport?.id === id) setSelectedReport(null);
    await loadReports();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-6 max-w-5xl mx-auto w-full pb-safe">
      {/* Tab Switcher: Investigate vs Saved Reports */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('investigate')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
            activeTab === 'investigate'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>New Deep Investigation</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
            activeTab === 'library'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Research Report Library ({reports.length})</span>
        </button>
      </div>

      {activeTab === 'investigate' ? (
        <>
          {/* Header Banner */}
          <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0C1222] via-[#0D1528] to-[#0A0E1A] border border-[#1F273C] shadow-xl space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide font-mono">
                  ANVESHA DEEP RESEARCH 2.0
                </h2>
                <p className="text-xs text-slate-400">
                  ANVESHA multi-stage research decomposition with contradiction detection and 3 selectable investigation depths.
                </p>
              </div>
            </div>

            {/* Query Input Box */}
            <div className="space-y-3 pt-2">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe your technical inquiry in detail (e.g. 'Investigate the architecture, security vulnerabilities, and comparative benchmarks of Tor SOCKS5 fail-closed routing vs clearnet HTTP proxies')..."
                rows={3}
                className="w-full p-3.5 rounded-xl bg-[#070A12] border border-[#232B3E] focus:border-amber-400/80 text-xs font-mono text-white placeholder-slate-500 outline-none resize-none"
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* 3 Research Depths */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono flex-wrap">
                  <span className="text-slate-400 text-[11px]">Depth:</span>
                  {(
                    [
                      { key: 'quick', label: 'Quick (2 Angles)' },
                      { key: 'deep', label: 'Deep (4 Angles)' },
                      { key: 'extended', label: 'Extended (6 Angles)' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setDepth(d.key)}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg transition-colors ${
                        depth === d.key
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'text-slate-400 hover:text-white bg-white/5'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
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
                <span>Multi-Angle Pipeline Active ({depth.toUpperCase()} MODE)</span>
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
                  <h3 className="text-sm font-bold text-white tracking-wide font-mono">
                    Structured Research Report
                  </h3>
                  <div className="text-[10px] font-mono text-slate-500">
                    Depth: {depth.toUpperCase()} &bull; Sources: {codeResults.length} code &bull; {webResults.length} web
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportMarkdown(reportText, query)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5 text-sky-400" />
                    <span>Export MD</span>
                  </button>

                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300 hover:text-white transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-400" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* Report Body */}
              <div className="text-sm text-slate-200">
                <MarkdownRenderer content={reportText} />
              </div>
            </div>
          )}
        </>
      ) : (
        /* Saved Reports Library */
        <div className="space-y-4">
          {selectedReport ? (
            <div className="p-6 rounded-2xl bg-[#090C16] border border-[#1E2638] shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  &larr; Back to Report Library
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportMarkdown(selectedReport.full_report_markdown, selectedReport.title)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300"
                  >
                    <FileDown className="w-3.5 h-3.5 text-sky-400" />
                    <span>Export</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {selectedReport.depth} depth
                </span>
                <h2 className="text-xl font-bold font-mono text-white mt-2">{selectedReport.title}</h2>
                <p className="text-xs text-slate-400 mt-1">Query: {selectedReport.query}</p>
              </div>

              {/* Contradictions Callout if any */}
              {selectedReport.contradictions && selectedReport.contradictions.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
                    <Scale className="w-4 h-4" />
                    <span>Detected Source Contradictions ({selectedReport.contradictions.length})</span>
                  </div>
                  {selectedReport.contradictions.map((c, i) => (
                    <div key={i} className="text-xs text-slate-300 pl-4 border-l-2 border-amber-400">
                      <div className="font-semibold text-white">{c.explanation}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        <span className="text-cyan-400">{c.source_a}</span>: "{c.claim_a}" vs{' '}
                        <span className="text-rose-400">{c.source_b}</span>: "{c.claim_b}"
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm text-slate-200">
                <MarkdownRenderer content={selectedReport.full_report_markdown} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.length === 0 ? (
                <div className="col-span-2 text-center py-16 bg-[#0b0e17] rounded-2xl border border-white/5">
                  <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-mono">No research reports saved yet</p>
                  <p className="text-xs text-slate-500 mt-1">Run a Deep Research inquiry to generate permanent reports.</p>
                </div>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className="p-5 rounded-2xl bg-[#0b0e17] border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {r.depth}
                        </span>
                        <button
                          onClick={(e) => handleDeleteReport(r.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="font-mono font-bold text-white text-sm line-clamp-1 mb-1">{r.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2">{r.summary}</p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>{new Date(r.created_at * 1000).toLocaleDateString()}</span>
                      <span className="text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Read Report <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
