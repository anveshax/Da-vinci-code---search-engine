import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Settings,
  Send,
  PhoneOff,
} from 'lucide-react';
import { VoiceState } from '../../services/voiceService';

interface VoiceControlsProps {
  status: VoiceState;
  isMuted: boolean;
  onToggleMic: () => void;
  onInterrupt: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onEndSession: () => void;
  onSendText?: (text: string) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  status,
  isMuted,
  onToggleMic,
  onInterrupt,
  onToggleMute,
  onOpenSettings,
  onEndSession,
  onSendText,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && onSendText) {
      onSendText(inputText.trim());
      setInputText('');
    }
  };

  const isSpeaking = status === 'SPEAKING';
  const isListening = status === 'LISTENING';

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Hybrid Text input bar */}
      {onSendText && (
        <form onSubmit={handleSend} className="relative flex items-center w-full">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message or speak naturally..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 pr-10 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            title="Send text"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Control Buttons Bar */}
      <div className="flex items-center justify-between px-2 pt-1">
        {/* Left: Mute & Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className={`p-2.5 rounded-xl border transition-all ${
              isMuted
                ? 'bg-rose-500/20 border-rose-500/30 text-rose-300 hover:bg-rose-500/30'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            title="Voice & Persona Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Primary Interruption / Mic Toggle */}
        <div className="flex items-center gap-3">
          {isSpeaking ? (
            <button
              onClick={onInterrupt}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs tracking-wide shadow-lg shadow-rose-900/40 transition-all transform hover:scale-105 active:scale-95"
              title="Interrupt Assistant (Barge-in)"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Interrupt</span>
            </button>
          ) : (
            <button
              onClick={onToggleMic}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-medium text-xs tracking-wide shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                isListening
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-900/30 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
              }`}
              title={isListening ? 'Click to stop listening' : 'Click to speak'}
            >
              <Mic className="w-4 h-4" />
              <span>{isListening ? 'Listening...' : 'Tap to Speak'}</span>
            </button>
          )}
        </div>

        {/* Right: End Conversation Session */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEndSession}
            className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
            title="End Voice Conversation"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
