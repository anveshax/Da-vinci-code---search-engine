import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Undo2, X } from 'lucide-react';
import { AppSidebar } from './components/AppSidebar';
import { AppHeader } from './components/AppHeader';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { PromptLibraryModal } from './components/PromptLibraryModal';
import { ModelCompareModal } from './components/ModelCompareModal';
import { AudioHapticControlsModal } from './components/AudioHapticControlsModal';
import { SearchHomepage } from './components/SearchHomepage';
import { SearchResultsView } from './components/SearchResultsView';
import { CodebaseExplorerView } from './components/CodebaseExplorerView';
import { DeepResearchWorkspace } from './components/DeepResearchWorkspace';
import { DebuggingAssistantView } from './components/DebuggingAssistantView';
import { ArtifactsWorkspace } from './components/ArtifactsWorkspace';
import { CodebaseToolsPanel } from './components/CodebaseToolsPanel';
import { FileViewerModal } from './components/FileViewerModal';
import { ExtensionSidePanel } from './components/ExtensionSidePanel';
import { MultiAgentWorkspace } from './components/MultiAgentWorkspace';
import { GovernanceConsole } from './components/GovernanceConsole';
import { WebDevStudioView } from './components/WebDevStudioView';
import { WebIntelligenceView } from './components/WebIntelligenceView';
import { HistoryView } from './components/HistoryView';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  checkBackendHealth,
  searchCodebase,
  fetchProjects,
  createProject as apiCreateProject,
  fetchConversations,
  fetchConversation as apiFetchConversation,
  renameConversation as apiRenameConversation,
  deleteConversation as apiDeleteConversation,
  clearAllHistory as apiClearAllHistory,
  togglePinConversation as apiTogglePinConversation,
  classifyAdaptiveTask,
} from './services/api';
import {
  ConnectionState,
  SearchResponse,
  SearchMode,
  ActiveView,
  Project,
  Conversation,
} from './types/api';
import { audioService } from './services/audioService';

export const App: React.FC = () => {
  // Navigation View State
  const [currentView, setCurrentView] = useState<ActiveView>('search');

  // Adaptive Workspace Engine State
  const [adaptiveMode, setAdaptiveMode] = useState<boolean>(true);
  const [adaptiveToast, setAdaptiveToast] = useState<{
    visible: boolean;
    message: string;
    targetLayout: string;
    previousLayout: ActiveView;
  } | null>(null);

  // Theme Engine State ('dark' = Obsidian Cyber, 'light' = Solar Glass)
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('anvesha_theme') as 'dark' | 'light') || 'dark';
  });

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('anvesha_theme', currentTheme);
  }, [currentTheme]);

  const handleToggleTheme = () => {
    setCurrentTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    audioService.playSphereInteraction();
  };

  // Backend Health Telemetry
  const [connection, setConnection] = useState<ConnectionState>({
    status: 'connecting',
    latencyMs: null,
    lastChecked: null,
    data: null,
    error: null,
  });

  // Projects & Workspace State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Conversations State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Search State
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);

  // Shell Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [isExtensionPanelOpen, setIsExtensionPanelOpen] = useState<boolean>(false);
  const [isExtensionPanelMinimized, setIsExtensionPanelMinimized] = useState<boolean>(false);

  // Modals State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState<boolean>(false);
  const [isModelCompareOpen, setIsModelCompareOpen] = useState<boolean>(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState<boolean>(false);
  const [inspectFilePath, setInspectFilePath] = useState<{ path: string; line: number } | null>(null);

  // Audio settings
  const [audioSettings, setAudioSettings] = useState(audioService.getSettings());

  // Subscribe to audio changes
  useEffect(() => {
    return audioService.subscribe((s) => setAudioSettings(s));
  }, []);

  // Fetch Health Telemetry
  const fetchHealth = useCallback(async () => {
    const result = await checkBackendHealth();
    if (result.data) {
      setConnection({
        status: 'online',
        latencyMs: result.latencyMs,
        lastChecked: new Date().toLocaleTimeString(),
        data: result.data,
        error: null,
      });
    } else {
      setConnection({
        status: 'offline',
        latencyMs: result.latencyMs,
        lastChecked: new Date().toLocaleTimeString(),
        data: null,
        error: result.error || 'Server unreachable',
      });
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 12000);

    fetchProjects().then((projs) => {
      setProjects(projs);
      if (projs.length > 0) setActiveProject(projs[0]);
    });

    fetchConversations().then(async (convs) => {
      setConversations(convs);
      const savedId = sessionStorage.getItem('anvesha_active_conv');
      if (savedId && convs.some((c) => c.id === savedId)) {
        try {
          const conv = await apiFetchConversation(savedId);
          loadConversationIntoWorkspace(conv);
        } catch {
          sessionStorage.removeItem('anvesha_active_conv');
        }
      }
    });

    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Global Keyboard Shortcuts (Ctrl/Cmd+K, Ctrl+Shift+N, Escape, Alt+1..5 layout switcher)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault();
        handleNewSearch();
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        setCurrentView('search');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setCurrentView('deep_research');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setCurrentView('explorer');
      } else if (e.altKey && e.key === '4') {
        e.preventDefault();
        setCurrentView('multi_agent');
      } else if (e.altKey && e.key === '5') {
        e.preventDefault();
        setCurrentView('governance');
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsSettingsModalOpen(false);
        setIsPromptLibraryOpen(false);
        setIsModelCompareOpen(false);
        setIsAudioModalOpen(false);
        setInspectFilePath(null);
        setAdaptiveToast(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Helper to load conversation into active search workspace
  const loadConversationIntoWorkspace = (conv: Conversation) => {
    setActiveConversationId(conv.id);
    sessionStorage.setItem('anvesha_active_conv', conv.id);
    const msgs = conv.messages || [];
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === 'user');
    const lastAssistantMsg = [...msgs].reverse().find((m) => m.role === 'assistant');
    const chatHistory = msgs.map((m) => ({ role: m.role, content: m.content }));

    const rawSources = (lastAssistantMsg?.sources as any[]) || [];
    const webResults = rawSources.filter((s) => s && ('url' in s || 'source_domain' in s));
    const codeResults = rawSources.filter((s) => s && ('file_path' in s || 'relative_path' in s));

    setSearchData({
      query: lastUserMsg?.content || conv.title,
      mode_requested: (conv.search_mode || conv.selected_mode || 'auto') as SearchMode,
      mode_used: (conv.search_mode === 'code' ? 'code' : 'web') as any,
      total_matches: webResults.length + codeResults.length,
      workspace_root: activeProject?.workspace_root || '',
      results: codeResults as any,
      web_results: webResults as any,
      initial_answer: lastAssistantMsg?.content || '',
      initial_conversation: chatHistory,
    });
    setCurrentView('results');
  };

  // New Search Action
  const handleNewSearch = () => {
    setActiveConversationId(null);
    sessionStorage.removeItem('anvesha_active_conv');
    setSearchData(null);
    setCurrentView('search');
    audioService.setApplicationState('IDLE');
  };

  // Adaptive Search & Workspace Routing
  const handleExecuteSearch = async (queryText: string, mode: SearchMode = 'auto') => {
    if (!queryText.trim()) return;

    // 1. Adaptive Intelligence Check
    if (adaptiveMode) {
      try {
        const classification = await classifyAdaptiveTask(queryText.trim());
        const previous = currentView;

        if (classification.task_type === 'multi_agent' || classification.complexity === 'autonomous') {
          setCurrentView('multi_agent');
          setAdaptiveToast({
            visible: true,
            message: `Adaptive Engine: Reconfigured workspace to Multi-Agent Collaboration (${Math.round(classification.confidence * 100)}% confidence).`,
            targetLayout: 'multi_agent',
            previousLayout: previous,
          });
          audioService.playSphereInteraction();
          return;
        }

        if (classification.task_type === 'research' && mode === 'auto') {
          setCurrentView('deep_research');
          setAdaptiveToast({
            visible: true,
            message: `Adaptive Engine: Reconfigured workspace to Deep Research Studio (${Math.round(classification.confidence * 100)}% confidence).`,
            targetLayout: 'deep_research',
            previousLayout: previous,
          });
          audioService.playSphereInteraction();
          return;
        }

        if (classification.task_type === 'code' && (queryText.includes('tree') || queryText.includes('ast') || queryText.includes('file'))) {
          setCurrentView('explorer');
          setAdaptiveToast({
            visible: true,
            message: `Adaptive Engine: Reconfigured workspace to Codebase Explorer (${Math.round(classification.confidence * 100)}% confidence).`,
            targetLayout: 'explorer',
            previousLayout: previous,
          });
          audioService.playSphereInteraction();
          return;
        }
      } catch (err) {
        console.warn('Adaptive classification skipped:', err);
      }
    }

    // 2. Standard Search Execution
    setIsSearching(true);
    audioService.setApplicationState('SEARCHING');
    audioService.triggerHaptic('activate');

    try {
      const response = await searchCodebase(queryText.trim(), mode);
      setSearchData(response);
      audioService.setApplicationState('COMPLETED');
      audioService.triggerHaptic('complete');

      setTimeout(() => {
        setIsSearching(false);
        setCurrentView('results');
        audioService.setApplicationState('IDLE');
      }, 350);
    } catch (err: unknown) {
      setIsSearching(false);
      audioService.setApplicationState('ERROR');
      audioService.triggerHaptic('error');
      const errMsg = err instanceof Error ? err.message : 'Search failed';
      alert(`Search Error:\n\n${errMsg}`);
    }
  };

  // Conversation Management Handlers
  const handleSelectConversation = async (id: string) => {
    try {
      const conv = await apiFetchConversation(id);
      loadConversationIntoWorkspace(conv);
    } catch {
      setActiveConversationId(id);
      sessionStorage.setItem('anvesha_active_conv', id);
      const conv = conversations.find((c) => c.id === id);
      if (conv) {
        setSearchData({
          query: conv.title,
          mode_requested: conv.search_mode || 'auto',
          mode_used: conv.search_mode === 'code' ? 'code' : 'web',
          total_matches: 0,
          workspace_root: activeProject?.workspace_root || '',
          results: [],
          web_results: [],
        });
      }
      setCurrentView('results');
    }
  };

  const handleConversationCreatedOrUpdated = (id: string) => {
    setActiveConversationId(id);
    sessionStorage.setItem('anvesha_active_conv', id);
    fetchConversations(activeProject?.id).then((convs) => {
      setConversations(convs);
    });
  };

  const handleTogglePinConversation = async (id: string) => {
    try {
      await apiTogglePinConversation(id);
      const updated = await fetchConversations(activeProject?.id);
      setConversations(updated);
    } catch {
      // Ignore
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const updated = await apiRenameConversation(id, newTitle);
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch {
      // Ignore
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await apiDeleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        handleNewSearch();
      }
    } catch {
      // Ignore
    }
  };

  const handleClearAllHistory = async () => {
    try {
      await apiClearAllHistory(activeProject?.id);
      setConversations([]);
      handleNewSearch();
    } catch {
      // Ignore
    }
  };

  const handleCreateProject = async (name: string) => {
    try {
      const created = await apiCreateProject(name);
      setProjects((prev) => [created, ...prev]);
      setActiveProject(created);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050508] text-slate-100 font-sans select-none relative">
      {/* Collapsible Commercial App Sidebar - Hidden during search results for Google-inspired full-width layout */}
      {currentView !== 'results' && (
        <AppSidebar
          currentView={currentView}
          onNavigate={(view) => {
            if (view === 'prompts') {
              setIsPromptLibraryOpen(true);
            } else if (view === 'settings') {
              setIsSettingsModalOpen(true);
            } else {
              setCurrentView(view);
            }
          }}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onTogglePinConversation={handleTogglePinConversation}
          onClearAllHistory={handleClearAllHistory}
          onNewSearch={handleNewSearch}
          projects={projects}
          activeProject={activeProject}
          onSelectProject={(p) => setActiveProject(p)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Main Workspace Frame */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${currentView === 'results' ? 'bg-[#202124]' : 'bg-[#050508]'} relative`}>
        {/* Top Header - Hidden on search results in favor of dedicated Google SearchHeader */}
        {currentView !== 'results' && (
          <AppHeader
            activeProject={activeProject}
            projects={projects}
            onSelectProject={(p) => setActiveProject(p)}
            onCreateProject={handleCreateProject}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenAudioModal={() => setIsAudioModalOpen(true)}
            onOpenMobileMenu={() => setIsMobileNavOpen(true)}
            onToggleExtensionPanel={() => {
              if (isExtensionPanelMinimized) {
                setIsExtensionPanelMinimized(false);
              } else {
                setIsExtensionPanelOpen((prev) => !prev);
              }
            }}
            isExtensionPanelOpen={isExtensionPanelOpen}
            soundEnabled={audioSettings.soundEnabled}
            connection={connection}
            adaptiveMode={adaptiveMode}
            onToggleAdaptiveMode={() => setAdaptiveMode((p) => !p)}
            activeLayout={currentView}
            onSelectLayout={(view) => setCurrentView(view)}
            currentTheme={currentTheme}
            onToggleTheme={handleToggleTheme}
          />
        )}

        {/* Adaptive Layout Transition Notification Toast */}
        {adaptiveToast?.visible && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-[#0B111E]/95 border border-sky-500/40 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-mono text-white animate-fade-in">
            <div className="p-1 rounded-lg bg-sky-500/20 text-sky-400">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <span>{adaptiveToast.message}</span>
            <button
              onClick={() => {
                if (adaptiveToast.previousLayout) {
                  setCurrentView(adaptiveToast.previousLayout);
                }
                setAdaptiveToast(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sky-300 font-bold flex items-center gap-1 transition-all"
            >
              <Undo2 className="w-3 h-3" />
              <span>Revert</span>
            </button>
            <button
              onClick={() => setAdaptiveToast(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Central Workspace Canvas */}
        <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          <ErrorBoundary onReset={handleNewSearch} fallbackTitle="Search Workspace Recovered">
            {/* View 1: Search Homepage with live 3D Earth Globe (No redundant TopBar) */}
            {currentView === 'search' && (
            <SearchHomepage
              onSearch={handleExecuteSearch}
              isSearching={isSearching}
              onOpenDashboard={() => setCurrentView('explorer')}
              workspacePath={activeProject?.workspace_root || connection.data?.telemetry.workspace_root}
              hideTopBar={true}
            />
          )}

          {/* View 1.5: Unified Activity & History (Google History Inspired) */}
          {currentView === 'history' && (
            <HistoryView
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onRenameConversation={handleRenameConversation}
              onTogglePinConversation={handleTogglePinConversation}
              onClearAllHistory={handleClearAllHistory}
              onNewSearch={handleNewSearch}
            />
          )}

          {/* View 2: Search Results & AI Answer View (Smooth Flex Scrolling) */}
          {currentView === 'results' && searchData && (
            <SearchResultsView
              searchData={searchData}
              activeConversationId={activeConversationId}
              onBackToSearch={handleNewSearch}
              onNewSearch={handleExecuteSearch}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onConversationCreated={handleConversationCreatedOrUpdated}
            />
          )}

          {/* View 2.5: Web Intelligence, Crawling & Indexing Infrastructure */}
          {currentView === 'web_intelligence' && <WebIntelligenceView />}

          {/* View 3: Web Development & UI Engineering Workspace */}
          {currentView === 'web_studio' && (
            <WebDevStudioView
              projectId={activeProject?.id || 'default'}
              onNavigateHome={() => setCurrentView('search')}
            />
          )}

          {/* View 3: Multi-Agent AI Governance Workspace */}
          {currentView === 'multi_agent' && (
            <MultiAgentWorkspace
              projectId={activeProject?.id || 'default'}
              onNavigateHome={() => setCurrentView('search')}
            />
          )}

          {/* View 4: Central Governance Console, Model Router & Self-Optimization */}
          {currentView === 'governance' && (
            <GovernanceConsole
              projectId={activeProject?.id || 'default'}
            />
          )}

          {/* View 5: Codebase Explorer Tree & Preview */}
          {currentView === 'explorer' && <CodebaseExplorerView />}

          {/* View 6: Deep Research Studio */}
          {currentView === 'deep_research' && <DeepResearchWorkspace />}

          {/* View 7: Debugging Assistant */}
          {currentView === 'debugging' && <DebuggingAssistantView />}

          {/* View 8: Saved Artifacts Workspace */}
          {currentView === 'artifacts' && <ArtifactsWorkspace />}

          {/* Views 9-12: Codebase Diagnostics Panel */}
          {(currentView === 'dependencies' ||
            currentView === 'impact' ||
            currentView === 'test_gaps' ||
            currentView === 'security') && (
            <div className="flex-1 p-3.5 sm:p-6 pb-safe overflow-y-auto max-w-5xl mx-auto w-full">
              <CodebaseToolsPanel
                onOpenFile={(path, line) => setInspectFilePath({ path, line: line || 1 })}
              />
            </div>
          )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Command Palette Modal (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(view) => {
          if (view === 'prompts') {
            setIsPromptLibraryOpen(true);
          } else if (view === 'settings') {
            setIsSettingsModalOpen(true);
          } else {
            setCurrentView(view);
          }
        }}
        onSetMode={(mode) => {
          if (searchData?.query) {
            handleExecuteSearch(searchData.query, mode);
          }
        }}
        onNewSearch={handleNewSearch}
        onToggleSound={() => audioService.toggleSound()}
        soundEnabled={audioSettings.soundEnabled}
        onToggleTheme={handleToggleTheme}
        currentTheme={currentTheme}
        onToggleAdaptiveMode={() => setAdaptiveMode((p) => !p)}
        adaptiveMode={adaptiveMode}
      />

      {/* Platform Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        connection={connection}
      />

      {/* Prompt Library Modal */}
      <PromptLibraryModal
        isOpen={isPromptLibraryOpen}
        onClose={() => setIsPromptLibraryOpen(false)}
        onSelectPrompt={(promptText) => {
          handleExecuteSearch(promptText, 'auto');
        }}
      />

      {/* Model Compare Modal */}
      <ModelCompareModal
        isOpen={isModelCompareOpen}
        onClose={() => setIsModelCompareOpen(false)}
        initialQuery={searchData?.query || ''}
      />

      {/* Audio & Haptic Controls Modal */}
      <AudioHapticControlsModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        settings={audioSettings}
        onUpdateSettings={(partial) => audioService.updateSettings(partial)}
      />

      {/* File Inspector Modal */}
      {inspectFilePath && (
        <FileViewerModal
          filePath={inspectFilePath.path}
          targetLineNumber={inspectFilePath.line}
          onClose={() => setInspectFilePath(null)}
        />
      )}

      {/* Extension Platform Drawer & Minimized Dock */}
      <ExtensionSidePanel
        isOpen={isExtensionPanelOpen}
        isMinimized={isExtensionPanelMinimized}
        onClose={() => setIsExtensionPanelOpen(false)}
        onToggleMinimize={() => setIsExtensionPanelMinimized((prev) => !prev)}
      />
    </div>
  );
};

export default App;
