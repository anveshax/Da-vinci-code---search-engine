import React from 'react';
import { X, Volume2, Gauge, Globe, Sliders, Cpu } from 'lucide-react';
import {
  VoicePersona,
  VoiceLanguage,
} from '../../services/voiceService';
import { VoicePersonaSelector } from './VoicePersonaSelector';

interface VoiceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  persona: VoicePersona;
  language: VoiceLanguage;
  speed: number;
  volume: number;
  onPersonaChange: (p: VoicePersona) => void;
  onLanguageChange: (l: VoiceLanguage) => void;
  onSpeedChange: (s: number) => void;
  onVolumeChange: (v: number) => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  isOpen,
  onClose,
  persona,
  language,
  speed,
  volume,
  onPersonaChange,
  onLanguageChange,
  onSpeedChange,
  onVolumeChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xl p-5 flex flex-col justify-between rounded-3xl overflow-y-auto border border-white/10 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
              Voice Engine Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Persona Selection */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-300 mb-2 block uppercase tracking-wide">
            Select Voice Persona
          </label>
          <VoicePersonaSelector selectedPersona={persona} onSelectPersona={onPersonaChange} />
        </div>

        {/* Section 2: Spoken Language */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Spoken Language & Code-Switching</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'auto', name: 'Auto-Detect', desc: 'EN / HI / Hinglish' },
              { id: 'en', name: 'English', desc: 'en-US / en-IN' },
              { id: 'hi', name: 'Hindi', desc: 'हिन्दी' },
              { id: 'hinglish', name: 'Hinglish', desc: 'Romanized Hindi' },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => onLanguageChange(lang.id as VoiceLanguage)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  language === lang.id
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-400'
                }`}
              >
                <div className="text-xs font-semibold">{lang.name}</div>
                <div className="text-[10px] text-slate-400">{lang.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Speech Rate & Volume Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                <span>Speech Speed</span>
              </span>
              <span className="font-mono text-cyan-400">{speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={speed}
              onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Volume</span>
              </span>
              <span className="font-mono text-emerald-400">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Provider Architecture info */}
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span>
            Real-time pipeline powered by Groq Whisper & Microsoft Edge Neural TTS with barge-in interruption.
          </span>
        </div>
      </div>

      {/* Done Button */}
      <button
        onClick={onClose}
        className="w-full mt-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs tracking-wider uppercase transition-colors"
      >
        Save & Return
      </button>
    </div>
  );
};
