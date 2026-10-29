import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { HealthCard } from './components/HealthCard';
import { DashboardEmptyState } from './components/DashboardEmptyState';
import { SearchHomepage } from './components/SearchHomepage';
import { SearchResultsView } from './components/SearchResultsView';
import { checkBackendHealth, searchCodebase } from './services/api';
import { ConnectionState, SearchResponse, SearchMode } from './types/api';
import { ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation View State: 'search' | 'results' | 'dashboard'
  const [currentView, setCurrentView] = useState<'search' | 'results' | 'dashboard'>('search');

  // Backend Health Telemetry
  const [connection, setConnection] = useState<ConnectionState>({
    status: 'connecting',
    latencyMs: null,
    lastChecked: null,
    data: null,
    error: null,
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Search State
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);

  const fetchHealth = useCallback(async () => {
    setIsRefreshing(true);
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
    setIsRefreshing(false);
  }, []);

  // Poll backend health on startup and every 10 seconds
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // Execute Codebase Search with Mode Support
  const handleExecuteSearch = async (queryText: string, mode: SearchMode = 'auto') => {
    if (!queryText.trim()) return;

    setIsSearching(true);
    try {
      const response = await searchCodebase(queryText.trim(), mode);
      setSearchData(response);
      // Brief pause to allow the user to see the 3D sphere accelerating during processing
      setTimeout(() => {
        setIsSearching(false);
        setCurrentView('results');
      }, 400);
    } catch (err: unknown) {
      setIsSearching(false);
      const errMsg = err instanceof Error ? err.message : 'Search failed';
      alert(`Search Error:\n\n${errMsg}`);
    }
  };

  // View 1: Google-Inspired Futuristic Search Homepage
  if (currentView === 'search') {
    return (
      <SearchHomepage
        onSearch={handleExecuteSearch}
        isSearching={isSearching}
        onOpenDashboard={() => setCurrentView('dashboard')}
        workspacePath={connection.data?.telemetry.workspace_root}
      />
    );
  }

  // View 2: Search Results View
  if (currentView === 'results' && searchData) {
    return (
      <SearchResultsView
        searchData={searchData}
        onBackToSearch={() => setCurrentView('search')}
        onNewSearch={handleExecuteSearch}
      />
    );
  }

  // View 3: Full Studio Dashboard (Milestone 1 Preserved)
  return (
    <div className="min-h-screen bg-obsidian-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        connection={connection}
        onRefresh={fetchHealth}
        isRefreshing={isRefreshing}
      />

      {/* Return to Search Homepage Bar */}
      <div className="bg-[#080C14] border-b border-surface-border px-6 py-2 flex items-center justify-between">
        <button
          onClick={() => setCurrentView('search')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-card hover:bg-surface-hover border border-surface-border text-xs font-medium text-slate-300 hover:text-white transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-cyber-cyan" />
          <span>Back to Search Homepage</span>
        </button>

        <span className="text-[11px] font-mono text-slate-500">
          Studio Workspace Mode &bull; Milestone 1 Diagnostics
        </span>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Central Workspace Canvas */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Live Telemetry Health Card */}
          <HealthCard connection={connection} />

          {/* Central Empty State / Ingestion View */}
          <DashboardEmptyState onPing={fetchHealth} isPinging={isRefreshing} />
        </main>
      </div>
    </div>
  );
};

export default App;
