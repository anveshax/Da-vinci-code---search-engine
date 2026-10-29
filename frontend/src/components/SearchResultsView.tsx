import React, { useState } from 'react';
import {
  FileCode,
  Code2,
  FileText,
  ArrowLeft,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Zap,
  FolderCode,
  Globe,
  AlertCircle,
  Link2
} from 'lucide-react';
import { SearchResponse, SearchResultItem, SearchMode } from '../types/api';
import { FileViewerModal } from './FileViewerModal';

interface SearchResultsViewProps {
  searchData: SearchResponse;
  onBackToSearch: () => void;
  onNewSearch: (query: string, mode?: SearchMode) => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  searchData,
  onBackToSearch,
  onNewSearch,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'symbol' | 'filename' | 'content'>('all');
  const [selectedResult, setSelectedResult] = useState<SearchResultItem | null>(null);
  const [headerQuery, setHeaderQuery] = useState(searchData.query);
  const [currentMode, setCurrentMode] = useState<SearchMode>(searchData.mode_requested || 'auto');

  const filteredCodeResults = searchData.results.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.match_type === activeFilter;
  });

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerQuery.trim()) {
      onNewSearch(headerQuery.trim(), currentMode);
    }
  };

  const getMatchBadge = (type: string, symbolName?: string | null) => {
    switch (type) {
      case 'symbol':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyber-violet/15 border border-cyber-violet/30 text-cyber-violetGlow text-[10px] font-mono font-semibold">
            <Code2 className="w-3 h-3" />
            <span>{symbolName ? `Symbol: ${symbolName}` : 'Symbol'}</span>
          </span>
        );
      case 'filename':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyber-cyan/15 border border-cyber-cyan/30 text-cyber-cyan text-[10px] font-mono font-semibold">
            <FileText className="w-3 h-3" />
            <span>File Path</span>
          </span>
        );
      case 'content':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono">
            <FileCode className="w-3 h-3" />
            <span>Source Code</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-sans">
      {/* Sticky Header Search Bar */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-[#1A1F2C] px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button
            onClick={onBackToSearch}
            className="p-2 rounded-xl bg-surface-card hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium"
            title="Return to Home"
          >
            <ArrowLeft className="w-4 h-4 text-cyber-cyan" />
            <span className="hidden sm:inline">Home</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-violet">
              CODEX INTELLIGENCE
            </span>
          </div>
        </div>

        {/* Compact Search Bar with Mode Selector in Header */}
        <div className="flex items-center gap-3 w-full max-w-xl">
          {/* Mode Selector in Header */}
          <div className="flex items-center gap-1 bg-[#111622] p-1 rounded-full border border-[#232B3E] shrink-0 text-[11px] font-mono">
            <button
              onClick={() => {
                setCurrentMode('auto');
                if (headerQuery.trim()) onNewSearch(headerQuery.trim(), 'auto');
              }}
              className={`px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                currentMode === 'auto'
                  ? 'bg-cyber-cyan text-black font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Auto</span>
            </button>
            <button
              onClick={() => {
                setCurrentMode('code');
                if (headerQuery.trim()) onNewSearch(headerQuery.trim(), 'code');
              }}
              className={`px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                currentMode === 'code'
                  ? 'bg-cyber-cyan text-black font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderCode className="w-3 h-3" />
              <span>Code</span>
            </button>
            <button
              onClick={() => {
                setCurrentMode('web');
                if (headerQuery.trim()) onNewSearch(headerQuery.trim(), 'web');
              }}
              className={`px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                currentMode === 'web'
                  ? 'bg-cyber-violet text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Web</span>
            </button>
          </div>

          <form onSubmit={handleHeaderSearchSubmit} className="relative flex-1">
            <button
              type="submit"
              aria-label="Submit search"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyber-cyan transition-colors cursor-pointer"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={headerQuery}
              onChange={(e) => setHeaderQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (headerQuery.trim()) {
                    onNewSearch(headerQuery.trim(), currentMode);
                  }
                }
              }}
              placeholder="Search codebase or public tech..."
              className="w-full pl-10 pr-4 py-2 rounded-full bg-[#111622] border border-[#232B3E] hover:border-cyber-cyan/50 focus:border-cyber-cyan text-xs font-mono text-white placeholder-slate-500 outline-none transition-all"
            />
          </form>
        </div>
      </header>

      {/* Main Results Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Results Metadata & Routing Telemetry */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1A1F2C]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-medium text-slate-200">
                Found <span className="font-bold text-cyber-cyan font-mono">{searchData.total_matches}</span> matches for{' '}
                <span className="font-semibold text-white font-mono">"{searchData.query}"</span>
              </h2>

              {/* Mode Badge */}
              {searchData.mode_used === 'code' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-[11px] font-mono font-medium">
                  <FolderCode className="w-3 h-3" />
                  <span>Codebase Search</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyber-violet/20 border border-cyber-violet/40 text-cyber-violetGlow text-[11px] font-mono font-medium">
                  <Globe className="w-3 h-3" />
                  <span>Web Sources</span>
                </span>
              )}
            </div>

            {searchData.routing_reason && (
              <p className="text-[11px] text-slate-400 font-mono">
                <span className="text-slate-500">Routing Decision:</span> {searchData.routing_reason}
              </p>
            )}
          </div>

          {/* Filter Pills for Code Search */}
          {searchData.mode_used === 'code' && (
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
              {(['all', 'symbol', 'content', 'filename'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1 rounded-full text-xs font-mono capitalize transition-all ${
                    activeFilter === filter
                      ? 'bg-cyber-cyan text-black font-bold shadow-sm shadow-cyber-cyan/30'
                      : 'bg-[#111622] text-slate-400 hover:text-white border border-[#232B3E]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 1. WEB MODE: Real Internet Results & Source Cards */}
        {searchData.mode_used === 'web' && (
          <div className="space-y-4">
            {/* Warning or Rate-Limit Banner if present */}
            {searchData.web_error && (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Notice from Search Engine</span>
                  <p className="text-amber-300/80 leading-relaxed">{searchData.web_error}</p>
                </div>
              </div>
            )}

            {/* List of Real Web Source Cards */}
            {searchData.web_results && searchData.web_results.length > 0 ? (
              <div className="space-y-3.5">
                {searchData.web_results.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl bg-[#0D111A] hover:bg-[#121824] border border-[#1C2333] hover:border-cyber-violet/50 transition-all space-y-2.5 shadow-sm"
                  >
                    {/* Header: Source Domain & External Link */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyber-violet/15 border border-cyber-violet/30 text-cyber-violetGlow text-[10px] font-mono font-medium">
                          <Link2 className="w-3 h-3" />
                          <span>{item.source_domain}</span>
                        </span>
                      </div>

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyber-cyan transition-colors"
                        title="Open external source"
                      >
                        <span className="hidden sm:inline truncate max-w-[260px]">{item.url}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Article / Documentation Title */}
                    <h3 className="text-sm font-semibold text-white hover:text-cyber-cyan transition-colors">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    </h3>

                    {/* Real Text Snippet */}
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {item.snippet}
                    </p>
                  </div>
                ))}
              </div>
            ) : !searchData.web_error ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-surface-card border border-surface-border mx-auto flex items-center justify-center text-slate-500">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-300">No web results found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No public web results found for "{searchData.query}". Try refining your keywords or search your local codebase.
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* 2. CODE MODE: Real Local Filesystem Results */}
        {searchData.mode_used === 'code' && (
          <div>
            {filteredCodeResults.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-surface-card border border-surface-border mx-auto flex items-center justify-center text-slate-500">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-300">No matching codebase results</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No occurrences of "{searchData.query}" found. You can try a different search term or switch to Web Research.
                </p>
                <div>
                  <button
                    onClick={() => onNewSearch(searchData.query, 'web')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyber-violet/20 border border-cyber-violet/40 text-cyber-violetGlow text-xs font-mono"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Search Web for "{searchData.query}"</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCodeResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedResult(item)}
                    className="group p-4 rounded-xl bg-[#0D111A] hover:bg-[#121824] border border-[#1C2333] hover:border-cyber-cyan/40 transition-all cursor-pointer space-y-2 shadow-sm"
                  >
                    {/* Header row: File path, line number, badge */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-mono font-medium text-cyber-cyan group-hover:text-cyber-cyanGlow transition-colors truncate">
                          {item.relative_path}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          :line {item.line_number}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {getMatchBadge(item.match_type, item.symbol_name)}
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyber-cyan transition-colors" />
                      </div>
                    </div>

                    {/* Code Snippet */}
                    <div className="p-2.5 rounded-lg bg-[#07090E] border border-[#161B28] text-xs font-mono text-slate-300 overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-all">{item.snippet}</pre>
                    </div>

                    {/* Action hint */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors">
                      <ExternalLink className="w-3 h-3 text-cyber-cyan" />
                      <span>Click to inspect code</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Code Inspector Modal for Local Code Matches */}
      {selectedResult && (
        <FileViewerModal
          filePath={selectedResult.relative_path}
          targetLineNumber={selectedResult.line_number}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};
