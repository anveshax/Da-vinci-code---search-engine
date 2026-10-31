import React, { useState } from 'react';
import {
  Bug,
  Terminal,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { runDebugAnalysis } from '../services/api';
import { DebugResult, SearchResultItem } from '../types/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FileViewerModal } from './FileViewerModal';

export const DebuggingAssistantView: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState('');
  const [stackTrace, setStackTrace] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DebugResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspectFile, setInspectFile] = useState<{ path: string; line: number } | null>(null);

  const handleRunAnalysis = async () => {
    if (!errorMessage.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await runDebugAnalysis(errorMessage.trim(), stackTrace.trim());
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Debug analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSampleError = () => {
    setErrorMessage("ModuleNotFoundError: No module named 'engine.scanner'");
    setStackTrace(
      'Traceback (most recent call last):\n  File "backend/app/api/search.py", line 6, in <module>\n    from engine.scanner import CodebaseScanner'
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] overflow-y-auto p-4 sm:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0C141E] via-[#0E1724] to-[#0A0F1A] border border-[#1E283A] shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Codebase Debugging Assistant
              </h2>
              <p className="text-xs text-slate-400">
                Paste error logs or stack traces to correlate repository source lines, identify root causes, and generate patches.
              </p>
            </div>
          </div>

          <button
            onClick={handleLoadSampleError}
            className="text-[11px] font-mono text-sky-400 hover:text-sky-300 underline underline-offset-2"
          >
            Load Sample Trace
          </button>
        </div>

        {/* Input Form */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">
              Error Message / Exception:
            </label>
            <input
              type="text"
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              placeholder="e.g. TypeError: Cannot read properties of undefined (reading 'map')"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080B14] border border-[#232B3E] focus:border-emerald-400 text-xs font-mono text-white placeholder-slate-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">
              Stack Trace & Terminal Logs (Optional):
            </label>
            <textarea
              value={stackTrace}
              onChange={(e) => setStackTrace(e.target.value)}
              placeholder="Paste stack trace or terminal error output here..."
              rows={4}
              className="w-full p-3 rounded-xl bg-[#080B14] border border-[#232B3E] focus:border-emerald-400 text-xs font-mono text-slate-300 placeholder-slate-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleRunAnalysis}
              disabled={isLoading || !errorMessage.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-black font-semibold text-xs font-mono transition-all shadow-md shadow-emerald-400/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Codebase...</span>
                </>
              ) : (
                <>
                  <Terminal className="w-4 h-4" />
                  <span>Analyze & Diagnose</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Box */}
      {result && (
        <div className="p-6 rounded-2xl bg-[#090C16] border border-[#1E2638] shadow-2xl space-y-5 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Diagnostic & Root Cause Report
            </h3>
            <p className="text-xs text-slate-400">
              Matched {result.matched_files.length} relevant source files in repository.
            </p>
          </div>

          {/* Matched Source Files Pills */}
          {result.matched_files.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                Correlated Code Paths:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.matched_files.map((m: SearchResultItem, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setInspectFile({ path: m.relative_path, line: m.line_number })}
                    className="p-2.5 rounded-lg bg-[#0F1424] border border-[#1E2638] hover:border-emerald-500/40 transition-colors text-left text-xs font-mono flex items-center justify-between"
                  >
                    <div className="truncate mr-2">
                      <span className="font-semibold text-white truncate block">
                        {m.relative_path}
                      </span>
                      <span className="text-[10px] text-slate-500">Line {m.line_number}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Diagnostic Synthesis */}
          <div className="pt-2 border-t border-white/5 text-sm text-slate-200">
            <MarkdownRenderer
              content={result.analysis}
              onCitationClick={(path, line) => setInspectFile({ path, line: line || 1 })}
            />
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {inspectFile && (
        <FileViewerModal
          filePath={inspectFile.path}
          targetLineNumber={inspectFile.line}
          onClose={() => setInspectFile(null)}
        />
      )}
    </div>
  );
};
