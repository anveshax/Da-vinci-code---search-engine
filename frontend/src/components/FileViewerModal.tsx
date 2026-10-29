import React, { useEffect, useState, useRef } from 'react';
import { X, FileCode, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { getFileContent } from '../services/api';
import { FileContentResponse } from '../types/api';

interface FileViewerModalProps {
  filePath: string;
  targetLineNumber?: number;
  onClose: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  filePath,
  targetLineNumber = 1,
  onClose,
}) => {
  const [data, setData] = useState<FileContentResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const highlightedLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getFileContent(filePath)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err: Error) => {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [filePath]);

  // Scroll to target highlighted line once loaded
  useEffect(() => {
    if (highlightedLineRef.current) {
      highlightedLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [data, targetLineNumber]);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#0A0D14] border border-[#1F2937] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 border-b border-[#1F2937] px-6 flex items-center justify-between bg-[#0F141F]/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="truncate">
              <span className="text-sm font-bold text-white tracking-wide">
                {data?.file_name || filePath.split('/').pop()}
              </span>
              <span className="hidden sm:inline text-xs font-mono text-slate-400 ml-3 truncate">
                {filePath}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {targetLineNumber && (
              <span className="px-2 py-0.5 rounded bg-cyber-cyan/15 border border-cyber-cyan/30 text-cyber-cyan text-xs font-mono">
                Line {targetLineNumber}
              </span>
            )}
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Copy file contents"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Close viewer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto bg-[#07090E] p-4 font-mono text-xs text-slate-300">
          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-cyber-cyan" />
              <span>Loading source code...</span>
            </div>
          )}

          {error && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-rose-400">
              <span>{error}</span>
            </div>
          )}

          {data && (
            <div className="divide-y divide-transparent">
              {data.content.split('\n').map((line, idx) => {
                const lineNum = idx + 1;
                const isTarget = lineNum === targetLineNumber;

                return (
                  <div
                    key={idx}
                    ref={isTarget ? highlightedLineRef : null}
                    className={`flex items-start py-0.5 px-3 rounded transition-colors ${
                      isTarget
                        ? 'bg-cyber-cyan/15 border-l-2 border-cyber-cyan text-cyber-cyanGlow font-semibold'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="w-12 text-right pr-4 text-slate-600 select-none shrink-0">
                      {lineNum}
                    </span>
                    <pre className="flex-1 whitespace-pre-wrap break-all">{line || ' '}</pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Meta */}
        {data && (
          <div className="h-10 border-t border-[#1F2937] px-6 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-[#0F141F]">
            <span>{data.total_lines} total lines &bull; {(data.size_bytes / 1024).toFixed(1)} KB</span>
            <span className="flex items-center gap-1.5 text-cyber-cyan">
              <ExternalLink className="w-3 h-3" />
              <span>Press Esc to close</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
