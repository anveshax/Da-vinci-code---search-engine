import React, { useState } from 'react';
import {
  FolderTree,
  Command,
  Volume2,
  VolumeX,
  Settings,
  Menu,
  ChevronDown,
  Check,
  Plus,
  Blocks,
  Sun,
  Moon,
  Sparkles,
  Search,
  Code2,
  Globe,
} from 'lucide-react';
import { Project, ConnectionState, ActiveView } from '../types/api';

interface AppHeaderProps {
  activeProject: Project | null;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onCreateProject: (name: string) => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenAudioModal: () => void;
  onOpenMobileMenu: () => void;
  onToggleExtensionPanel: () => void;
  isExtensionPanelOpen: boolean;
  soundEnabled: boolean;
  connection: ConnectionState;
  // Adaptive Workspace Engine Props
  adaptiveMode: boolean;
  onToggleAdaptiveMode: () => void;
  activeLayout: ActiveView;
  onSelectLayout: (layout: ActiveView) => void;
  // Theme Engine Props
  currentTheme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeProject,
  projects,
  onSelectProject,
  onCreateProject,
  onOpenCommandPalette,
  onOpenSettings,
  onOpenAudioModal,
  onOpenMobileMenu,
  onToggleExtensionPanel,
  isExtensionPanelOpen,
  soundEnabled,
  connection,
  adaptiveMode,
  onToggleAdaptiveMode,
  activeLayout,
  onSelectLayout,
  currentTheme,
  onToggleTheme,
}) => {
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreatingProject(false);
      setProjectDropdownOpen(false);
    }
  };

  return (
    <header className="h-14 border-b border-white/10 bg-[#000000]/90 backdrop-blur-md px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 shrink-0 z-30 select-none pt-safe">
      {/* Left: Google-style Hamburger Menu & Workspace Selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 rounded-xl text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-white/10 touch-target transition-colors flex items-center justify-center shrink-0"
          title="Main menu"
          aria-label="Main menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* ANVESHA Brand Pill */}
        <div
          className="flex items-center gap-1.5 shrink-0 cursor-pointer"
          onClick={() => onSelectLayout('search')}
          title="ANVESHA Home"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-xs tracking-wider text-white font-mono hidden xs:inline">
            ANVESHA
          </span>
        </div>

        {/* Project / Workspace Dropdown */}
        <div className="relative min-w-0">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 hover:border-white/20 text-xs font-sans text-[#e8eaed] transition-all min-h-[40px] max-w-full"
            title="Switch Workspace Project"
          >
            <FolderTree className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />
            <span className="font-medium truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[200px]">
              {activeProject?.name || 'Main Repository'}
            </span>
            <ChevronDown className="w-3 h-3 text-[#9aa0a6] shrink-0" />
          </button>

          {projectDropdownOpen && (
            <div
              className="absolute left-0 top-11 z-50 w-64 max-w-[calc(100vw-2rem)] bg-[#0c101a]/95 border border-white/10 backdrop-blur-2xl rounded-2xl shadow-2xl p-1.5 text-xs font-sans animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2.5 py-1 text-[11px] uppercase tracking-wider text-[#9aa0a6] border-b border-white/10 mb-1 font-medium">
                Workspaces ({projects.length})
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {projects.map((p) => {
                  const isSelected = p.id === activeProject?.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProject(p);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors ${
                        isSelected
                          ? 'bg-[#8ab4f8]/15 text-[#8ab4f8] font-medium'
                          : 'text-[#e8eaed] hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Create new project input */}
              <div className="border-t border-white/10 mt-1 pt-1.5">
                {isCreatingProject ? (
                  <form onSubmit={handleCreateSubmit} className="flex gap-1.5 p-1">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Project name..."
                      autoFocus
                      className="flex-1 px-2.5 py-1 rounded-lg bg-black/60 border border-white/20 text-xs text-[#e8eaed] placeholder-[#9aa0a6] outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded-lg bg-[#8ab4f8] text-[#000000] font-semibold text-xs hover:bg-[#a8c7fa] transition-colors"
                    >
                      Add
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsCreatingProject(true)}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-white/5 text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#8ab4f8]" />
                    <span>Create New Workspace</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Unified Navigation Mode Switcher */}
      <div className="hidden lg:flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/10 text-xs font-sans shadow-sm">
        <button
          onClick={onToggleAdaptiveMode}
          className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
            adaptiveMode
              ? 'bg-[#8ab4f8]/20 text-[#8ab4f8] font-medium shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e8eaed]'
          }`}
          title={adaptiveMode ? 'Adaptive Layout Active: Automatically adapts layout based on task' : 'Manual Layout Mode Locked'}
        >
          <Sparkles className={`w-3.5 h-3.5 ${adaptiveMode ? 'text-[#8ab4f8] animate-pulse' : 'text-[#9aa0a6]'}`} />
          <span>Auto-Adapt</span>
        </button>

        <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

        <button
          onClick={() => onSelectLayout('search')}
          className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
            activeLayout === 'search' || activeLayout === 'results'
              ? 'bg-white/10 text-white font-medium shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e8eaed]'
          }`}
          title="Google-inspired AI Search & Research Engine"
        >
          <Search className="w-3.5 h-3.5 text-[#8ab4f8]" />
          <span>AI Search</span>
        </button>

        <button
          onClick={() => onSelectLayout('web_studio')}
          className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
            activeLayout === 'web_studio'
              ? 'bg-white/10 text-white font-medium shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e8eaed]'
          }`}
          title="Web Development & UI Engineering Studio"
        >
          <Code2 className="w-3.5 h-3.5 text-[#81c995]" />
          <span>Web Studio</span>
        </button>

        <button
          onClick={() => onSelectLayout('web_intelligence')}
          className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
            activeLayout === 'web_intelligence'
              ? 'bg-white/10 text-white font-medium shadow-sm'
              : 'text-[#9aa0a6] hover:text-[#e8eaed]'
          }`}
          title="Web Intelligence, Crawling & Search Index"
        >
          <Globe className="w-3.5 h-3.5 text-[#8ab4f8]" />
          <span>Web Intelligence</span>
        </button>
      </div>

      {/* Right: Command Palette, Theme, Telemetry, Sound, Settings */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Command Palette Trigger Button (Desktop & Tablet) */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 hover:border-white/20 text-[#9aa0a6] hover:text-[#e8eaed] text-xs font-sans transition-all group shadow-sm min-h-[38px]"
          title="Open Command Palette (Ctrl+K)"
        >
          <Command className="w-3.5 h-3.5 text-[#8ab4f8]" />
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-[#9aa0a6] text-[10px] font-mono border border-white/10">
            ⌘K
          </kbd>
        </button>

        {/* Theme Toggle Button (Light/Dark) */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-full hover:bg-white/10 text-[#9aa0a6] hover:text-[#e8eaed] transition-colors touch-target"
          title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
          aria-label="Toggle color theme"
        >
          {currentTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-[#fdd663]" />
          ) : (
            <Moon className="w-4 h-4 text-[#8ab4f8]" />
          )}
        </button>

        {/* Backend Telemetry Status Pill (Compact on mobile) */}
        <div
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-sans border min-h-[30px] ${
            connection.status === 'online'
              ? 'bg-[#137333]/20 border-[#137333]/40 text-[#81c995]'
              : connection.status === 'connecting'
              ? 'bg-[#ea8600]/20 border-[#ea8600]/40 text-[#fdd663]'
              : 'bg-[#c5221f]/20 border-[#c5221f]/40 text-[#f28b82]'
          }`}
          title={`Backend status: ${connection.status}${connection.latencyMs ? ` (${connection.latencyMs}ms)` : ''}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              connection.status === 'online'
                ? 'bg-[#81c995] animate-pulse'
                : connection.status === 'connecting'
                ? 'bg-[#fdd663] animate-ping'
                : 'bg-[#f28b82]'
            }`}
          />
          <span className="capitalize hidden sm:inline">{connection.status}</span>
          {connection.latencyMs !== null && (
            <span className="text-[#9aa0a6] hidden md:inline">({connection.latencyMs}ms)</span>
          )}
        </div>

        {/* Extension Platform Drawer Trigger (Hidden on mobile <sm to prevent toolbar crowding) */}
        <button
          onClick={onToggleExtensionPanel}
          className={`hidden sm:flex p-2 rounded-full transition-all touch-target ${
            isExtensionPanelOpen
              ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
              : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-white/10'
          }`}
          title="Toggle Extension Platform Drawer"
          aria-label="Extensions"
        >
          <Blocks className="w-4 h-4" />
        </button>

        {/* Spatial Audio Quick Trigger Button (Hidden on mobile <sm to prevent toolbar crowding) */}
        <button
          onClick={onOpenAudioModal}
          className={`hidden sm:flex p-2 rounded-full transition-all touch-target ${
            soundEnabled
              ? 'bg-[#8ab4f8]/20 text-[#8ab4f8]'
              : 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-white/10'
          }`}
          title={soundEnabled ? 'Spatial Audio Active (Click to configure)' : 'Spatial Audio Muted'}
          aria-label="Audio controls"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-full hover:bg-white/10 text-[#9aa0a6] hover:text-[#e8eaed] transition-colors touch-target"
          title="Platform Settings"
          aria-label="Platform Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
