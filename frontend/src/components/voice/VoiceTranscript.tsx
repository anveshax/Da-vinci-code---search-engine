import React, { useRef, useEffect } from 'react';
import { User, Sparkles, ExternalLink, Copy, Check, Trash2, ArrowUpRight } from 'lucide-react';
import { VoiceMessage, VoiceState } from '../../services/voiceService';

interface VoiceTranscriptProps {
  messages: VoiceMessage[];
  status: VoiceState;
  interimTranscript: string;
  streamingAssistantText: string;
  onSelectQuery?: (query: string) => void;
  onClearHistory?: () => void;
}

export const VoiceTranscript: React.FC<VoiceTranscriptProps> = ({
  messages,
  status,
  interimTranscript,
  streamingAssistantText,
  onSelectQuery,
  onClearHistory,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Auto-scroll to bottom on new messages or streaming tokens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript, streamingAssistantText]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-300">
            Voice Conversation Transcript
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
            {messages.length} turns
          </span>
        </div>
        {messages.length > 0 && onClearHistory && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
            title="Clear voice transcript"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !interimTranscript && !streamingAssistantText && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-sm font-medium text-slate-200">Say anything to start talking</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Try: &ldquo;Search for latest quantum computing breakthroughs&rdquo; or &ldquo;Open Web Intelligence&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[11px] font-medium text-slate-400">
              {msg.role === 'user' ? (
                <>
                  <span>You</span>
                  <User className="w-3 h-3 text-cyan-400" />
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Anvesha</span>
                </>
              )}
            </div>

            <div
              className={`relative group max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white rounded-tr-xs shadow-md shadow-cyan-900/20'
                  : 'bg-slate-800/90 text-slate-100 rounded-tl-xs border border-white/10 shadow-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Verified Sources Pills for Assistant answers */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/10">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Grounded Sources ({msg.sources.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 transition-colors"
                        title={s.snippet || s.title}
                      >
                        <span className="font-mono text-[9px] text-cyan-400">[{idx + 1}]</span>
                        <span className="truncate max-w-[130px]">{s.title || 'Source'}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Hover Actions */}
              <div
                className={`absolute top-2 ${
                  msg.role === 'user' ? '-left-16' : '-right-16'
                } hidden group-hover:flex items-center gap-1 bg-slate-900/90 border border-white/10 rounded-lg p-1 text-slate-400 shadow-md`}
              >
                <button
                  onClick={() => handleCopy(msg.id, msg.text)}
                  className="p-1 hover:text-white rounded"
                  title="Copy text"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                {msg.role === 'user' && onSelectQuery && (
                  <button
                    onClick={() => onSelectQuery(msg.text)}
                    className="p-1 hover:text-cyan-400 rounded"
                    title="Search in Anvesha"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Interim User Speech */}
        {interimTranscript && (
          <div className="flex flex-col items-end">
            <span className="text-[11px] font-medium text-cyan-400/80 mb-1 flex items-center gap-1">
              <span>Listening...</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tr-xs px-4 py-2.5 text-sm bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 italic">
              {interimTranscript}
            </div>
          </div>
        )}

        {/* Streaming Assistant Response */}
        {streamingAssistantText && (
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-medium text-emerald-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Anvesha is speaking...</span>
            </span>
            <div className="max-w-[85%] rounded-2xl rounded-tl-xs px-4 py-2.5 text-sm bg-slate-800 text-slate-100 border border-emerald-500/30 shadow-md">
              <p className="whitespace-pre-wrap">{streamingAssistantText}</p>
              <span className="inline-block w-2 h-3.5 bg-emerald-400 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {status === 'PROCESSING' && !streamingAssistantText && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span>Analyzing request & gathering intelligence...</span>
          </div>
        )}
      </div>
    </div>
  );
};
