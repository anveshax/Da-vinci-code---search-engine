import React from 'react';
import { VoiceState } from '../../services/voiceService';

interface VoiceOrbProps {
  status: VoiceState;
  audioLevel: number; // 0.0 to 1.0 real RMS amplitude
  size?: number;      // px diameter (default: 160)
  onClick?: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  status,
  audioLevel,
  size = 160,
  onClick,
}) => {
  // Compute dynamic scale and glow based on real audio level
  const clampedLevel = Math.max(0, Math.min(1, audioLevel));
  const scale = 1 + clampedLevel * 0.45;
  const outerScale = 1 + clampedLevel * 0.85;

  // Color profiles per voice state
  const getThemeStyles = () => {
    switch (status) {
      case 'LISTENING':
        return {
          core: 'from-cyan-400 via-sky-500 to-blue-600',
          glow: 'rgba(6, 182, 212, 0.45)',
          outerRing: 'border-cyan-400/40',
          pulseSpeed: 'animate-pulse',
        };
      case 'SPEAKING':
        return {
          core: 'from-emerald-400 via-teal-500 to-cyan-600',
          glow: 'rgba(16, 185, 129, 0.5)',
          outerRing: 'border-emerald-400/40',
          pulseSpeed: '',
        };
      case 'PROCESSING':
        return {
          core: 'from-amber-400 via-purple-500 to-indigo-600',
          glow: 'rgba(168, 85, 247, 0.45)',
          outerRing: 'border-purple-400/40',
          pulseSpeed: 'animate-spin-slow',
        };
      case 'INTERRUPTED':
        return {
          core: 'from-rose-500 via-amber-500 to-cyan-500',
          glow: 'rgba(244, 63, 94, 0.5)',
          outerRing: 'border-rose-400/50',
          pulseSpeed: 'animate-ping',
        };
      case 'ERROR':
        return {
          core: 'from-rose-600 via-red-500 to-orange-600',
          glow: 'rgba(239, 68, 68, 0.4)',
          outerRing: 'border-red-500/40',
          pulseSpeed: '',
        };
      case 'IDLE':
      default:
        return {
          core: 'from-cyan-500/80 via-blue-600/70 to-slate-800/80',
          glow: 'rgba(56, 189, 248, 0.25)',
          outerRing: 'border-cyan-500/20',
          pulseSpeed: 'animate-pulse',
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Voice Orb - Status: ${status}`}
      className="relative flex items-center justify-center cursor-pointer select-none focus:outline-none transition-transform duration-100 ease-out active:scale-95"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {/* Outer ambient radiant glow */}
      <div
        className="absolute rounded-full pointer-events-none transition-all duration-150 ease-out"
        style={{
          width: `${size * 1.5}px`,
          height: `${size * 1.5}px`,
          background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
          transform: `scale(${outerScale})`,
          opacity: 0.6 + clampedLevel * 0.4,
        }}
      />

      {/* Ripple ring 1 */}
      <div
        className={`absolute rounded-full border border-dashed transition-all duration-200 ${theme.outerRing} ${theme.pulseSpeed}`}
        style={{
          width: `${size * 1.25}px`,
          height: `${size * 1.25}px`,
          transform: `scale(${outerScale * 0.95})`,
          opacity: 0.5 + clampedLevel * 0.5,
        }}
      />

      {/* Ripple ring 2 */}
      <div
        className={`absolute rounded-full border border-solid transition-all duration-150 ${theme.outerRing}`}
        style={{
          width: `${size * 1.1}px`,
          height: `${size * 1.1}px`,
          transform: `scale(${scale * 0.98})`,
          opacity: 0.7,
        }}
      />

      {/* Core illuminated glowing sphere */}
      <div
        className={`relative rounded-full bg-gradient-to-tr shadow-2xl flex items-center justify-center transition-transform duration-100 ease-out ${theme.core}`}
        style={{
          width: `${size * 0.75}px`,
          height: `${size * 0.75}px`,
          transform: `scale(${scale})`,
          boxShadow: `0 0 35px ${theme.glow}, inset 0 0 20px rgba(255, 255, 255, 0.4)`,
        }}
      >
        {/* Specular highlight */}
        <div className="absolute top-2 left-3 w-8 h-8 rounded-full bg-white/40 blur-xs" />

        {/* Center state icon / pulse */}
        {status === 'PROCESSING' && (
          <div className="w-8 h-8 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
        )}
      </div>
    </div>
  );
};
