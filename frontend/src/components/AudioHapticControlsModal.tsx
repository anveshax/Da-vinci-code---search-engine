import React, { useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Volume1,
  Vibrate,
  Radio,
  Sparkles,
  Sliders,
  X,
  Play,
  Check,
  AlertCircle
} from 'lucide-react';
import { audioService, AudioHapticSettings } from '../services/audioService';

interface AudioHapticControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: AudioHapticSettings;
  onUpdateSettings?: (partial: Partial<AudioHapticSettings>) => void;
}

export const AudioHapticControlsModal: React.FC<AudioHapticControlsModalProps> = ({
  isOpen,
  onClose,
  settings: propSettings,
  onUpdateSettings: propOnUpdateSettings,
}) => {
  const [internalSettings, setInternalSettings] = React.useState<AudioHapticSettings>(
    audioService.getSettings()
  );

  useEffect(() => {
    const unsub = audioService.subscribe((s) => setInternalSettings(s));
    return unsub;
  }, []);

  const settings = propSettings || internalSettings;
  const onUpdateSettings =
    propOnUpdateSettings ||
    ((partial: Partial<AudioHapticSettings>) => audioService.updateSettings(partial));

  const isVibrationSupported = audioService.isHapticsSupported();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    onUpdateSettings({ soundEnabled: !settings.soundEnabled });
  };

  const handleToggleHaptics = () => {
    if (!isVibrationSupported) return;
    onUpdateSettings({ hapticsEnabled: !settings.hapticsEnabled });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onUpdateSettings({ masterVolume: val });
  };

  const handleTestSound = () => {
    // Ensure context is initialized
    audioService.initContext();
    audioService.playTestSound();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Futuristic Modal Card - Pure Black #000000 */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-black border border-white/15 p-6 shadow-2xl shadow-black space-y-6 text-left"
        style={{ backgroundColor: '#000000' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-settings-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 border border-white/15 text-slate-200">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 id="audio-settings-title" className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                Audio & Haptic Core
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Spatial sound synthesis & tactile feedback
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close audio controls"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Control Groups */}
        <div className="space-y-4">
          {/* 1. Master Sound Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#080808] border border-white/10 transition-all">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg transition-colors ${
                  settings.soundEnabled
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-400/30'
                    : 'bg-white/5 text-slate-400 border border-white/5'
                }`}
              >
                {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Spatial Sound Engine</div>
                <div className="text-[11px] text-slate-400">
                  {settings.soundEnabled ? 'Synthesizer Active' : 'Muted (Click to activate)'}
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleSound}
              role="switch"
              aria-checked={settings.soundEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                settings.soundEnabled ? 'bg-sky-400' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                  settings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 2. Master Volume Slider */}
          <div className="p-3.5 rounded-xl bg-[#080808] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Volume1 className="w-3.5 h-3.5 text-sky-400" />
                <span>Master Volume</span>
              </span>
              <span className="text-sky-300 font-bold">
                {Math.round(settings.masterVolume * 100)}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.masterVolume}
              onChange={handleVolumeChange}
              disabled={!settings.soundEnabled}
              aria-label="Master audio volume"
              className="w-full h-1.5 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-sky-400 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* 3. Toggles: Ambient Hum & SFX */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ambient Toggle */}
            <button
              type="button"
              disabled={!settings.soundEnabled}
              onClick={() => onUpdateSettings({ ambientEnabled: !settings.ambientEnabled })}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.ambientEnabled && settings.soundEnabled
                  ? 'bg-sky-500/10 border-sky-400/30 text-white'
                  : 'bg-[#080808] border-white/10 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span
                  className={`w-2 h-2 rounded-full ${
                    settings.ambientEnabled && settings.soundEnabled ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
              </div>
              <div className="text-xs font-semibold">Idle Energy Hum</div>
              <div className="text-[10px] text-slate-400 font-mono">Atmospheric drone</div>
            </button>

            {/* Sound Effects Toggle */}
            <button
              type="button"
              disabled={!settings.soundEnabled}
              onClick={() => onUpdateSettings({ sfxEnabled: !settings.sfxEnabled })}
              className={`p-3 rounded-xl border text-left transition-all ${
                settings.sfxEnabled && settings.soundEnabled
                  ? 'bg-sky-500/10 border-sky-400/30 text-white'
                  : 'bg-[#080808] border-white/10 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span
                  className={`w-2 h-2 rounded-full ${
                    settings.sfxEnabled && settings.soundEnabled ? 'bg-sky-400' : 'bg-slate-600'
                  }`}
                />
              </div>
              <div className="text-xs font-semibold">Sound Effects</div>
              <div className="text-[10px] text-slate-400 font-mono">Chimes & sweeps</div>
            </button>
          </div>

          {/* 4. Haptic Feedback Toggle (with hardware honesty) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#080808] border border-white/10">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg transition-colors ${
                  settings.hapticsEnabled && isVibrationSupported
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-slate-400 border border-white/5'
                }`}
              >
                <Vibrate className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white">Haptic Vibration</div>
                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                  {isVibrationSupported ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Supported on this device</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-500">Not supported on this browser</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleHaptics}
              disabled={!isVibrationSupported}
              role="switch"
              aria-checked={settings.hapticsEnabled && isVibrationSupported}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed ${
                settings.hapticsEnabled && isVibrationSupported ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                  settings.hapticsEnabled && isVibrationSupported ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleTestSound}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-slate-200 hover:text-white transition-all"
          >
            <Play className="w-3.5 h-3.5 text-sky-400" />
            <span>Test Audio & Haptics</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-black font-bold text-xs font-mono tracking-wide transition-all shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
