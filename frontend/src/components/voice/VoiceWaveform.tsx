import React from 'react';
import { VoiceState } from '../../services/voiceService';

interface VoiceWaveformProps {
  status: VoiceState;
  frequencyData: number[]; // Array of normalized frequency amplitudes [0..1]
  height?: number;
  barCount?: number;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  status,
  frequencyData,
  height = 56,
  barCount = 24,
}) => {
  // Use sliced or filled bands
  const bands = frequencyData.length >= barCount
    ? frequencyData.slice(0, barCount)
    : [...frequencyData, ...new Array(barCount - frequencyData.length).fill(0)];

  const getBarColor = () => {
    switch (status) {
      case 'SPEAKING':
        return 'bg-gradient-to-t from-emerald-500 via-teal-400 to-cyan-300';
      case 'PROCESSING':
        return 'bg-gradient-to-t from-purple-500 via-indigo-400 to-amber-300';
      case 'INTERRUPTED':
        return 'bg-gradient-to-t from-rose-500 to-amber-400';
      case 'ERROR':
        return 'bg-gradient-to-t from-red-500 to-rose-400';
      case 'LISTENING':
      default:
        return 'bg-gradient-to-t from-cyan-600 via-sky-400 to-blue-300';
    }
  };

  return (
    <div
      className="flex items-center justify-center gap-1.5 w-full select-none"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {bands.map((val, idx) => {
        // Compute bar height with a minimum baseline of 4px
        const barHeightPx = Math.max(4, Math.min(height, val * height * 1.25));

        return (
          <div
            key={idx}
            className={`w-1.5 rounded-full transition-all duration-75 ease-out ${getBarColor()}`}
            style={{
              height: `${barHeightPx}px`,
              opacity: status === 'IDLE' ? 0.35 : 0.85 + val * 0.15,
            }}
          />
        );
      })}
    </div>
  );
};
