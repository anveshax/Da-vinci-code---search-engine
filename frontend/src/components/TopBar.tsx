import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface TopBarProps {
  onOpenStudio: () => void;
  onOpenAudio?: () => void;
  soundEnabled?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenStudio,
  onOpenAudio,
  soundEnabled = false,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 px-6 md:px-8 flex items-center justify-between z-30 bg-transparent select-none">
      {/* Left Links (Hidden on mobile <768px) */}
      <nav className="hidden md:flex items-center gap-7">
        <a
          href="#about"
          onClick={(e) => {
            e.preventDefault();
            alert('Codebase Intelligence — Minimalist semantic code search & AST analysis core.');
          }}
          className="text-[15px] font-normal text-white/90 hover:text-white transition-opacity duration-150 tracking-wide"
        >
          About
        </a>
        <a
          href="#docs"
          onClick={(e) => {
            e.preventDefault();
            alert('Documentation — Search across symbols, functions, classes, and source files using AST indexing.');
          }}
          className="text-[15px] font-normal text-white/90 hover:text-white transition-opacity duration-150 tracking-wide"
        >
          Docs
        </a>
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-5 ml-auto">
        {/* Optional Audio Toggle Pill */}
        {onOpenAudio && (
          <button
            type="button"
            onClick={onOpenAudio}
            title="Spatial Audio & Haptics"
            className="p-1.5 rounded-full text-white/60 hover:text-white transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-ice" />
            ) : (
              <VolumeX className="w-4 h-4 text-white/40" />
            )}
          </button>
        )}

        {/* Studio Link */}
        <button
          type="button"
          onClick={onOpenStudio}
          className="text-[15px] font-normal text-white/90 hover:text-white transition-opacity duration-150 tracking-wide"
        >
          Studio
        </button>

        {/* 3x3 Dot-Grid App Launcher Icon */}
        <button
          type="button"
          onClick={onOpenStudio}
          title="Studio Applications"
          aria-label="Studio Apps"
          className="p-1.5 text-white/80 hover:text-white transition-opacity flex items-center justify-center"
        >
          <svg
            className="w-4 h-4 fill-current"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="2" cy="2" r="1.5" />
            <circle cx="8" cy="2" r="1.5" />
            <circle cx="14" cy="2" r="1.5" />
            <circle cx="2" cy="8" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="14" cy="8" r="1.5" />
            <circle cx="2" cy="14" r="1.5" />
            <circle cx="8" cy="14" r="1.5" />
            <circle cx="14" cy="14" r="1.5" />
          </svg>
        </button>

        {/* 36px Circular Avatar Button with Thin White-Grey Ring */}
        <button
          type="button"
          onClick={onOpenStudio}
          title="Account / Workspace"
          aria-label="User Workspace"
          className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center bg-white/5 hover:border-white/60 transition-all text-xs font-mono font-medium text-white/90 shadow-sm"
        >
          <span>CI</span>
        </button>
      </div>
    </header>
  );
};
