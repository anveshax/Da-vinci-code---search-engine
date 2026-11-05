import React from 'react';
import { Sparkles } from 'lucide-react';
import { VoiceState } from '../../services/voiceService';

interface VoiceSessionIndicatorProps {
  status: VoiceState;
  audioLevel: number;
  isOpen: boolean;
  isMuted?: boolean;
  onClick: () => void;
}

export const VoiceSessionIndicator: React.FC<VoiceSessionIndicatorProps> = ({
  status,
  audioLevel,
  isOpen,
  onClick,
}) => {
  if (isOpen) return null; // Hidden when full assistant modal is open

  const getStatusColor = () => {
    switch (status) {
      case 'LISTENING':
        return 'from-cyan-500 to-blue-600 border-cyan-400/40 text-cyan-300';
      case 'SPEAKING':
        return 'from-emerald-500 to-teal-600 border-emerald-400/40 text-emerald-300';
      case 'PROCESSING':
        return 'from-purple-500 to-indigo-600 border-purple-400/40 text-purple-300';
      case 'ERROR':
        return 'from-red-500 to-rose-600 border-red-400/40 text-red-300';
      case 'IDLE':
      default:
        return 'from-slate-800 to-slate-900 border-white/10 text-slate-300';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'LISTENING':
        return 'Listening...';
      case 'SPEAKING':
        return 'Speaking...';
      case 'PROCESSING':
        return 'Thinking...';
      case 'INTERRUPTED':
        return 'Interrupted';
      case 'ERROR':
        return 'Voice Error';
      case 'IDLE':
      default:
        return 'Voice Assistant';
    }
  };

  const pulseScale = 1 + Math.min(0.4, audioLevel * 0.5);

  return (
    <button
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r ${getStatusColor()} border backdrop-blur-xl shadow-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 select-none focus:outline-none`}
      title="Open Anvesha Voice Assistant"
      aria-label="Open Voice Assistant"
    >
      {/* Micro Pulsing Orb */}
      <div className="relative flex items-center justify-center w-5 h-5">
        <div
          className={`absolute rounded-full transition-transform duration-75 ${
            status === 'LISTENING' ? 'bg-cyan-400' : status === 'SPEAKING' ? 'bg-emerald-400' : 'bg-slate-400'
          }`}
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${pulseScale})`,
            opacity: 0.6,
          }}
        />
        <div className="relative z-10 w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
      </div>

      <span className="text-xs font-semibold tracking-wide text-white">
        {getStatusText()}
      </span>

      <Sparkles className="w-3.5 h-3.5 text-cyan-200 opacity-80" />
    </button>
  );
};
