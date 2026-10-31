import React, { useState, useEffect } from 'react';
import { TopBar } from './TopBar';
import { SearchBar } from './SearchBar';
import { EarthGlobe } from './EarthGlobe';
import { SearchMode } from '../types/api';
import { audioService } from '../services/audioService';
import { AudioHapticControlsModal } from './AudioHapticControlsModal';
import { globeSettingsService, resolvePalette, GlobeSettings } from '../services/globeSettings';

interface SearchHomepageProps {
  onSearch: (query: string, mode: SearchMode) => void;
  isSearching: boolean;
  onOpenDashboard: () => void;
  workspacePath?: string;
  hideTopBar?: boolean;
}

export const SearchHomepage: React.FC<SearchHomepageProps> = ({
  onSearch,
  isSearching,
  onOpenDashboard,
  hideTopBar = true,
}) => {
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [audioSettings, setAudioSettings] = useState(audioService.getSettings());
  const [globeSettings, setGlobeSettings] = useState<GlobeSettings>(globeSettingsService.getSettings());
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [showGlobe, setShowGlobe] = useState<boolean>(() => {
    return localStorage.getItem('anvesha_show_globe') !== 'false';
  });

  const toggleGlobe = () => {
    setShowGlobe((prev) => {
      const next = !prev;
      localStorage.setItem('anvesha_show_globe', String(next));
      return next;
    });
  };

  // Sync audio settings
  useEffect(() => {
    const unsubscribe = audioService.subscribe((settings) => {
      setAudioSettings(settings);
    });
    return unsubscribe;
  }, []);

  // Sync globe settings for ambient backdrop
  useEffect(() => {
    const unsubscribe = globeSettingsService.subscribe((settings) => {
      setGlobeSettings(settings);
    });
    return unsubscribe;
  }, []);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  const palette = resolvePalette(globeSettings);

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col justify-between select-none bg-[#000000]"
    >
      {/* 64px Top Navigation Bar - Only show if not embedded inside AppHeader */}
      {!hideTopBar && (
        <TopBar
          onOpenStudio={onOpenDashboard}
          onOpenAudio={() => setIsAudioModalOpen(true)}
          soundEnabled={audioSettings.soundEnabled}
        />
      )}

      {/* Luminous Atmospheric Illumination behind the Globe */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] max-w-[96vw] max-h-[96vw] pointer-events-none z-0 rounded-full transition-colors duration-700"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${palette.ambientBackdrop} 0%, rgba(10, 15, 30, 0.05) 45%, rgba(0, 0, 0, 0) 72%)`,
          filter: 'blur(28px)',
          opacity: globeSettings.atmosphericGlow * globeSettings.ambientBrightness,
        }}
      />

      {/* Main 3D Dot-Matrix Earth Globe (Dominant Centered Visual Element) */}
      {showGlobe && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] sm:w-[560px] md:w-[600px] lg:w-[640px] h-[92vw] sm:h-[560px] md:h-[600px] lg:h-[640px] max-w-[640px] max-h-[640px] pointer-events-auto z-10 flex items-center justify-center opacity-100">
          <EarthGlobe isSearching={isSearching} reducedMotion={reducedMotion} />
        </div>
      )}

      {/* Subtle edge vignette to ensure complete seamless blending with deep black canvas */}
      <div
        className="absolute inset-0 pointer-events-none z-[15]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.85) 100%)',
        }}
      />

      {/* Centered Integrated Stack: Wordmark in Visual Center of Globe, Search Bar directly beneath */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pointer-events-none -translate-y-[2%] sm:-translate-y-[3%]">
        {/* ANVESHA Brand Wordmark (Clean Centered Display) */}
        <div className="text-center mb-5 sm:mb-6 pointer-events-auto flex items-center justify-center gap-2.5 sm:gap-3">
          {/* Sparkle 4-point star icon */}
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-[#38bdf8] drop-shadow-[0_0_12px_rgba(56,189,248,0.75)]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
          <h1
            className="text-3xl sm:text-4xl md:text-[46px] lg:text-[50px] font-semibold text-white tracking-wider leading-none select-none font-sans antialiased"
            style={{
              textShadow:
                '0 0 24px rgba(180, 215, 255, 0.3), 0 2px 10px rgba(0, 0, 0, 0.85)',
            }}
          >
            ANVESHA
          </h1>
        </div>

        {/* Integrated Centered Search Bar */}
        <div className="pointer-events-auto w-full max-w-[640px] flex justify-center">
          <SearchBar onSearch={onSearch} isSearching={isSearching} />
        </div>
      </main>

      {/* Subtle Bottom Status Pill */}
      <div className="relative z-30 pb-3 flex justify-center pointer-events-auto">
        <button
          onClick={toggleGlobe}
          className="px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-[11px] font-sans text-neutral-500 hover:text-neutral-300 transition-all flex items-center gap-1.5"
          title="Toggle 3D Globe Centerpiece"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              showGlobe ? 'bg-[#8ab4f8]' : 'bg-neutral-600'
            }`}
          />
          <span>{showGlobe ? 'Globe Active' : 'Globe Muted'}</span>
        </button>
      </div>

      {/* Audio & Haptic Controls Modal */}
      <AudioHapticControlsModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        settings={audioSettings}
        onUpdateSettings={(partial) => audioService.updateSettings(partial)}
      />
    </div>
  );
};
