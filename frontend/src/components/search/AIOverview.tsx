import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Copy,
  Check,
  RotateCcw,
  Square,
  Loader2
} from 'lucide-react';
import { CitationItem } from '../../types/api';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { SourcePreviewList } from './SourcePreviewList';
import { FollowUpInput } from './FollowUpInput';

interface AIOverviewProps {
  answer: string;
  isStreaming: boolean;
  statusMessage?: string;
  currentPhase?: string;
  citations: CitationItem[];
  isSpeaking: boolean;
  onToggleSpeech: () => void;
  onStopStreaming?: () => void;
  onRetryStreaming?: () => void;
  onFollowUp: (question: string) => void;
  onCodeClick?: (filePath: string, line?: number) => void;
  providerUsed?: string | null;
  modelUsed?: string | null;
  modeUsed?: string | null;
}

export const AIOverview: React.FC<AIOverviewProps> = ({
  answer,
  isStreaming,
  statusMessage,
  currentPhase,
  citations,
  isSpeaking,
  onToggleSpeech,
  onStopStreaming,
  onRetryStreaming,
  onFollowUp,
  onCodeClick,
  providerUsed,
  modelUsed,
  modeUsed,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (answer) {
      navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!answer && !isStreaming) {
    return null;
  }

  return (
    <section
      aria-label="AI Overview"
      className="rounded-2xl bg-[#282a2c] border border-[#3c4043] p-5 sm:p-6 mb-6 transition-colors shadow-sm"
    >
      {/* AI Overview Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#3c4043]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#303134] flex items-center justify-center text-[#8ab4f8]">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-sans font-medium text-[#e8eaed] tracking-normal">
            AI Overview
          </h2>
          {providerUsed && (
            <span className="text-[11px] font-sans text-[#9aa0a6] hidden sm:inline">
              &bull; {providerUsed} {modelUsed ? `(${modelUsed})` : ''} {modeUsed ? `(${modeUsed})` : ''}
            </span>
          )}
          {isStreaming && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#303134] text-[11px] font-sans text-[#bdc1c6]">
              <Loader2 className="w-3 h-3 text-[#8ab4f8] animate-spin" />
              <span>{statusMessage || (currentPhase ? `Phase: ${currentPhase}` : 'Generating...')}</span>
            </span>
          )}
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Read Aloud Button */}
          {answer && !isStreaming && (
            <button
              type="button"
              onClick={onToggleSpeech}
              className={`p-1.5 rounded-full text-xs font-sans flex items-center gap-1 transition-colors ${
                isSpeaking
                  ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
                  : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134]'
              }`}
              title={isSpeaking ? 'Stop speaking' : 'Listen to AI Overview'}
              aria-label={isSpeaking ? 'Stop speaking' : 'Listen to overview'}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Copy Button */}
          {answer && !isStreaming && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-full text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134] transition-colors"
              title="Copy answer"
              aria-label="Copy answer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}

          {/* Stop Button (while streaming) */}
          {isStreaming && onStopStreaming && (
            <button
              type="button"
              onClick={onStopStreaming}
              className="px-2.5 py-1 rounded-full bg-[#303134] hover:bg-[#3c4043] text-xs font-sans text-[#e8eaed] flex items-center gap-1 transition-colors"
              title="Stop response generation"
            >
              <Square className="w-3 h-3 fill-current text-rose-400" />
              <span>Stop</span>
            </button>
          )}

          {/* Regenerate Button */}
          {!isStreaming && onRetryStreaming && (
            <button
              type="button"
              onClick={onRetryStreaming}
              className="p-1.5 rounded-full text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134] transition-colors"
              title="Regenerate answer"
              aria-label="Regenerate"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Collapse / Expand Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1.5 rounded-full text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#303134] transition-colors"
            title={isCollapsed ? 'Expand AI Overview' : 'Collapse AI Overview'}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Overview Body */}
      {!isCollapsed ? (
        <div className="pt-4">
          {/* Desktop 65% / 35% two-column split; Mobile stacked */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Main AI Answer Column (~65%) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="text-[15px] text-[#e8eaed] leading-relaxed font-sans prose-dark">
                <MarkdownRenderer
                  content={answer}
                  onCitationClick={onCodeClick}
                />
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-[#8ab4f8] animate-pulse align-middle" />
                )}
              </div>

              {/* Integrated Follow-up Input */}
              <FollowUpInput
                onSubmit={onFollowUp}
                disabled={isStreaming}
              />
            </div>

            {/* Source Previews Column (~35%) */}
            {citations.length > 0 && (
              <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#3c4043] pt-4 lg:pt-0 lg:pl-5">
                <SourcePreviewList
                  citations={citations}
                  onCodeClick={onCodeClick}
                  initialCount={3}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => setIsCollapsed(false)}
          className="pt-2 text-xs font-sans text-[#8ab4f8] hover:underline cursor-pointer"
        >
          AI Overview collapsed — click to expand.
        </div>
      )}
    </section>
  );
};
