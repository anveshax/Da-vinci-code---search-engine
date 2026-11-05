import React, { useState, useEffect } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Sliders,
  AlertCircle,
  Keyboard,
} from 'lucide-react';
import {
  voiceService,
  VoiceEngineState,
} from '../../services/voiceService';
import { VoiceOrb } from './VoiceOrb';
import { VoiceWaveform } from './VoiceWaveform';
import { VoiceTranscript } from './VoiceTranscript';
import { VoiceControls } from './VoiceControls';
import { VoiceSettings } from './VoiceSettings';
import { VoiceSessionIndicator } from './VoiceSessionIndicator';
import { VoiceErrorBoundary } from './VoiceErrorBoundary';

interface VoiceAssistantProps {
  onNavigateView?: (view: string) => void;
  onSearchQuery?: (query: string) => void;
  onToggleTheme?: (theme?: 'dark' | 'light') => void;
  currentTheme?: 'dark' | 'light';
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onNavigateView,
  onSearchQuery,
  onToggleTheme,
}) => {
  const [state, setState] = useState<VoiceEngineState>(voiceService.getState());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Subscribe to voiceService state changes
  useEffect(() => {
    const unsub = voiceService.subscribe((s) => setState(s));

    // Register navigation callback for spoken commands
    voiceService.registerNavigationHandler((target, action) => {
      if (action === 'navigate' && onNavigateView) {
        onNavigateView(target);
      } else if (action === 'theme' && onToggleTheme) {
        onToggleTheme(target as 'dark' | 'light');
      }
    });

    return () => {
      unsub();
    };
  }, [onNavigateView, onToggleTheme]);

  // Keyboard shortcut listener (Escape to close, Space to interrupt if speaking)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.isOpen) return;

      if (e.key === 'Escape') {
        voiceService.closeAssistant();
      } else if (e.key === ' ' && e.target === document.body) {
        // Space bar shortcut outside input fields
        e.preventDefault();
        if (state.status === 'SPEAKING') {
          voiceService.interrupt();
        } else {
          voiceService.interrupt();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen, state.status]);

  const handleOpen = () => {
    voiceService.openAssistant();
  };

  const handleClose = () => {
    voiceService.closeAssistant();
    setIsSettingsOpen(false);
  };

  const handleToggleMic = () => {
    if (state.status === 'LISTENING') {
      voiceService.interrupt();
    } else {
      voiceService.startSession();
    }
  };

  const handleInterrupt = () => {
    voiceService.interrupt();
  };

  const handleToggleMute = () => {
    voiceService.toggleMute();
  };

  const handleSendText = (text: string) => {
    voiceService.sendTextMessage(text);
  };

  const handleSearchInAnvesha = (query: string) => {
    if (onSearchQuery) {
      onSearchQuery(query);
      handleClose();
    }
  };

  return (
    <>
      {/* Floating Pill indicator when minimized */}
      <VoiceSessionIndicator
        status={state.status}
        audioLevel={state.audioLevel}
        isOpen={state.isOpen}
        isMuted={state.isMuted}
        onClick={handleOpen}
      />

      {/* Main Voice Assistant Modal / Overlay */}
      {state.isOpen && (
        <VoiceErrorBoundary onReset={() => voiceService.startSession()}>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
            <div
              className={`relative flex flex-col justify-between w-full rounded-3xl bg-slate-950/95 border border-white/10 shadow-2xl text-slate-100 overflow-hidden transition-all duration-300 ${
                isExpanded
                  ? 'max-w-5xl h-[92vh]'
                  : 'max-w-2xl h-[85vh] sm:h-[750px]'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-900/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold tracking-wide text-slate-100">
                        ANVESHA Voice 3.0
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                        {state.persona.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          state.status === 'LISTENING'
                            ? 'bg-cyan-400 animate-ping'
                            : state.status === 'SPEAKING'
                            ? 'bg-emerald-400 animate-pulse'
                            : state.status === 'PROCESSING'
                            ? 'bg-purple-400 animate-pulse'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span>
                        {state.status === 'LISTENING'
                          ? 'Listening for speech...'
                          : state.status === 'SPEAKING'
                          ? 'Speaking response...'
                          : state.status === 'PROCESSING'
                          ? 'Synthesizing knowledge...'
                          : state.status === 'INTERRUPTED'
                          ? 'Interrupted'
                          : 'Idle'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Voice Settings"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors hidden sm:block"
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Close Voice Assistant (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Error Alert Banner */}
              {state.error && (
                <div className="px-5 py-2.5 bg-rose-500/20 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>{state.error}</span>
                  </div>
                  <button
                    onClick={() => voiceService.startSession()}
                    className="px-2.5 py-1 rounded-md bg-rose-500/30 hover:bg-rose-500/40 text-[11px] font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Main Visual & Transcript Content */}
              <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0 overflow-hidden">
                {/* Left/Top: Voice Orb & Audio Waveform Stage */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-900/30 rounded-2xl border border-white/5 md:w-1/2">
                  <div className="my-auto flex flex-col items-center justify-center">
                    <VoiceOrb
                      status={state.status}
                      audioLevel={state.audioLevel}
                      size={isExpanded ? 180 : 140}
                      onClick={handleToggleMic}
                    />

                    {/* Dynamic Real Web Audio Visualizer */}
                    <div className="mt-6 flex flex-col items-center w-full max-w-xs">
                      <VoiceWaveform
                        status={state.status}
                        frequencyData={state.frequencyData}
                        height={48}
                      />
                    </div>
                  </div>

                  {/* Speech status cue */}
                  <div className="mt-auto text-center pt-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                    <Keyboard className="w-3.5 h-3.5 opacity-60" />
                    <span>Speak naturally. Tap orb or press Space to interrupt.</span>
                  </div>
                </div>

                {/* Right/Bottom: Live Transcript & Citations */}
                <div className="flex-1 min-h-[220px] md:h-auto overflow-hidden">
                  <VoiceTranscript
                    messages={state.messages}
                    status={state.status}
                    interimTranscript={state.interimTranscript}
                    streamingAssistantText={state.streamingAssistantText}
                    onSelectQuery={handleSearchInAnvesha}
                    onClearHistory={() => voiceService.clearMessages()}
                  />
                </div>
              </div>

              {/* Footer Controls */}
              <div className="px-5 py-3 border-t border-white/10 bg-slate-900/40">
                <VoiceControls
                  status={state.status}
                  isMuted={state.isMuted}
                  onToggleMic={handleToggleMic}
                  onInterrupt={handleInterrupt}
                  onToggleMute={handleToggleMute}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onEndSession={handleClose}
                  onSendText={handleSendText}
                />
              </div>

              {/* Settings Flyout Drawer */}
              <VoiceSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                persona={state.persona}
                language={state.language}
                speed={state.speed}
                volume={state.volume}
                onPersonaChange={(p) => voiceService.setPersona(p)}
                onLanguageChange={(l) => voiceService.setLanguage(l)}
                onSpeedChange={(s) => voiceService.setSpeed(s)}
                onVolumeChange={(v) => voiceService.setVolume(v)}
              />
            </div>
          </div>
        </VoiceErrorBoundary>
      )}
    </>
  );
};
