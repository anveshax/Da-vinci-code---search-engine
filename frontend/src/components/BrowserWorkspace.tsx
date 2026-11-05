import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Lock,
  Globe,
  Plus,
  X,
  BookOpen,
  Bookmark,
  Shield,
  Smartphone,
  Monitor,
  AlertTriangle,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  navigateOmnibox,
  extractReaderContent,
  fetchBrowserTabs,
  saveBrowserTab,
  deleteBrowserTab,
  createBrowserBookmark,
  fetchBrowserBookmarks,
} from '../services/api';
import { BrowserTab, BrowserTabMode, ReaderArticle } from '../types/api';
import { ReaderModeView } from './ReaderModeView';

interface BrowserWorkspaceProps {
  initialUrl?: string;
  onPerformSearch?: (query: string) => void;
}

export const BrowserWorkspace: React.FC<BrowserWorkspaceProps> = ({
  initialUrl = 'https://en.wikipedia.org/wiki/Artificial_intelligence',
  onPerformSearch,
}) => {
  // Tabs State
  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 'default_tab_1',
      title: 'Wikipedia: Artificial Intelligence',
      url: initialUrl,
      tab_mode: 'normal',
      is_active: true,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('default_tab_1');

  // Omnibox and Navigation State
  const [omniboxInput, setOmniboxInput] = useState<string>(initialUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(true);
  const [navHistory, setNavHistory] = useState<Record<string, string[]>>({
    default_tab_1: [initialUrl],
  });
  const [historyIndex, setHistoryIndex] = useState<Record<string, number>>({
    default_tab_1: 0,
  });

  // Security & Sanitization Feedback
  const [strippedTrackers, setStrippedTrackers] = useState<string[]>([]);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Reader Mode State
  const [readerArticle, setReaderArticle] = useState<ReaderArticle | null>(null);
  const [isExtractingReader, setIsExtractingReader] = useState<boolean>(false);

  // Bookmark status
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Load tabs on mount
  useEffect(() => {
    fetchBrowserTabs().then((persisted) => {
      if (persisted && persisted.length > 0) {
        setTabs(persisted);
        const active = persisted.find((t) => t.is_active) || persisted[0];
        setActiveTabId(active.id);
        setOmniboxInput(active.url);
      }
    });
  }, []);

  // Sync omnibox input when tab changes
  useEffect(() => {
    if (activeTab) {
      setOmniboxInput(activeTab.url);
      setSecurityNotice(null);
      setStrippedTrackers([]);
      checkIfBookmarked(activeTab.url);
    }
  }, [activeTabId]);

  const checkIfBookmarked = async (url: string) => {
    try {
      const bmarks = await fetchBrowserBookmarks();
      setIsBookmarked(bmarks.some((b) => b.url === url));
    } catch {
      setIsBookmarked(false);
    }
  };

  const handleNavigate = async (targetInput?: string) => {
    const input = targetInput !== undefined ? targetInput : omniboxInput;
    if (!input.trim()) return;

    setIsLoading(true);
    setSecurityNotice(null);
    setStrippedTrackers([]);

    try {
      const res = await navigateOmnibox(input, activeTab.tab_mode, activeTab.url);

      if (res.error) {
        setSecurityNotice(res.error);
        setIsLoading(false);
        return;
      }

      if (res.tracking_params_stripped && res.tracking_params_stripped.length > 0) {
        setStrippedTrackers(res.tracking_params_stripped);
      }

      const newUrl = res.resolved_url;
      setOmniboxInput(newUrl);

      // Update active tab state
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, url: newUrl, title: res.target_type === 'search' ? `Search: ${res.query}` : newUrl }
            : t
        )
      );

      // Record in tab history stack
      setNavHistory((prev) => {
        const stack = prev[activeTabId] || [];
        const idx = historyIndex[activeTabId] ?? 0;
        const newStack = [...stack.slice(0, idx + 1), newUrl];
        return { ...prev, [activeTabId]: newStack };
      });
      setHistoryIndex((prev) => ({
        ...prev,
        [activeTabId]: (prev[activeTabId] ?? 0) + 1,
      }));

      // If it's a search query and onPerformSearch is provided
      if (res.action === 'search' && res.query && onPerformSearch) {
        onPerformSearch(res.query);
      }

      // Check bookmark status
      checkIfBookmarked(newUrl);
    } catch (err: any) {
      setSecurityNotice(err.message || 'Navigation failed (Tor Fail-Closed or Network Error)');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    const stack = navHistory[activeTabId] || [];
    const idx = historyIndex[activeTabId] ?? 0;
    if (idx > 0) {
      const targetUrl = stack[idx - 1];
      setHistoryIndex((prev) => ({ ...prev, [activeTabId]: idx - 1 }));
      setOmniboxInput(targetUrl);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, url: targetUrl } : t))
      );
    }
  };

  const handleForward = () => {
    const stack = navHistory[activeTabId] || [];
    const idx = historyIndex[activeTabId] ?? 0;
    if (idx < stack.length - 1) {
      const targetUrl = stack[idx + 1];
      setHistoryIndex((prev) => ({ ...prev, [activeTabId]: idx + 1 }));
      setOmniboxInput(targetUrl);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, url: targetUrl } : t))
      );
    }
  };

  const handleAddTab = async (mode: BrowserTabMode = 'normal') => {
    const newId = `tab_${Date.now()}`;
    const defaultUrl =
      mode === 'tor' ? 'http://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion' : 'https://anvesha.ai';
    const newTab: BrowserTab = {
      id: newId,
      title: mode === 'tor' ? 'Tor Private Tab' : mode === 'incognito' ? 'Incognito Tab' : 'New Tab',
      url: defaultUrl,
      tab_mode: mode,
      is_active: true,
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    };

    setTabs((prev) => [...prev.map((t) => ({ ...t, is_active: false })), newTab]);
    setActiveTabId(newId);
    setOmniboxInput(defaultUrl);
    setNavHistory((prev) => ({ ...prev, [newId]: [defaultUrl] }));
    setHistoryIndex((prev) => ({ ...prev, [newId]: 0 }));

    if (mode === 'normal') {
      saveBrowserTab(newTab);
    }
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Keep at least one tab open
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    deleteBrowserTab(tabId);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleToggleReaderMode = async () => {
    if (readerArticle) {
      setReaderArticle(null);
      return;
    }
    setIsExtractingReader(true);
    try {
      const article = await extractReaderContent(activeTab.url);
      setReaderArticle(article);
    } catch (err: any) {
      setSecurityNotice('Unable to extract reader view for this page.');
    } finally {
      setIsExtractingReader(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (isBookmarked) return;
    try {
      await createBrowserBookmark(activeTab.title || activeTab.url, activeTab.url, 'Browser');
      setIsBookmarked(true);
    } catch (err) {
      console.error('Bookmark creation failed:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] text-slate-200 overflow-hidden">
      {/* 1. Tab Bar Strip */}
      <div className="flex items-center gap-1 px-2 pt-2 bg-[#0b0e17] border-b border-white/10 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isTor = tab.tab_mode === 'tor';
          const isIncognito = tab.tab_mode === 'incognito';

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-mono max-w-[200px] min-w-[120px] cursor-pointer transition-all border-t border-x ${
                isActive
                  ? isTor
                    ? 'bg-[#120a1f] border-purple-500/50 text-purple-200 shadow-[0_-2px_8px_rgba(168,85,247,0.15)]'
                    : isIncognito
                    ? 'bg-[#121620] border-slate-500/50 text-slate-200'
                    : 'bg-[#101626] border-cyan-500/50 text-white shadow-[0_-2px_8px_rgba(6,182,212,0.15)]'
                  : 'bg-black/30 border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {isTor ? (
                <Globe className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              ) : isIncognito ? (
                <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              )}

              <span className="truncate flex-1 text-[11px]">{tab.title || tab.url}</span>

              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Tab Creation Buttons */}
        <div className="flex items-center gap-1 pl-1 pb-1">
          <button
            onClick={() => handleAddTab('normal')}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="New Tab"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleAddTab('incognito')}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/10 border border-white/10"
            title="New Incognito Tab"
          >
            Incognito
          </button>
          <button
            onClick={() => handleAddTab('tor')}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/30"
            title="New Tor Private Tab"
          >
            Tor (.onion)
          </button>
        </div>
      </div>

      {/* 2. Omnibox & Navigation Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0e121e] border-b border-white/10">
        {/* Nav Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleForward}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleNavigate()}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Reload"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Smart Omnibox */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNavigate();
          }}
          className="flex-1 relative flex items-center"
        >
          <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none">
            {activeTab.tab_mode === 'tor' ? (
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                TOR ONION
              </span>
            ) : activeTab.url.startsWith('https://') ? (
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Search className="w-3.5 h-3.5 text-slate-500" />
            )}
          </div>

          <input
            type="text"
            value={omniboxInput}
            onChange={(e) => setOmniboxInput(e.target.value)}
            placeholder="Search or enter web address..."
            className={`w-full pl-24 pr-24 py-1.5 rounded-xl text-xs font-mono text-white outline-none border transition-all ${
              activeTab.tab_mode === 'tor'
                ? 'bg-[#150d24] border-purple-500/40 focus:border-purple-400'
                : 'bg-[#0b0e17] border-white/10 focus:border-cyan-400'
            }`}
          />

          {/* Right Action Icons in Omnibox */}
          <div className="absolute right-2 flex items-center gap-1">
            {/* ClearURLs Stripped indicator */}
            {strippedTrackers.length > 0 && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-help"
                title={`Stripped ${strippedTrackers.length} tracking parameters: ${strippedTrackers.join(', ')}`}
              >
                Shield: -{strippedTrackers.length} Trackers
              </span>
            )}

            {/* Reader Mode Toggle */}
            <button
              type="button"
              onClick={handleToggleReaderMode}
              disabled={isExtractingReader}
              className={`p-1 rounded-md transition-colors ${
                readerArticle
                  ? 'bg-cyan-500 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Distraction-Free Reader Mode"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>

            {/* Bookmark Button */}
            <button
              type="button"
              onClick={handleToggleBookmark}
              className={`p-1 rounded-md transition-colors ${
                isBookmarked
                  ? 'text-amber-400'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-white/10'
              }`}
              title={isBookmarked ? 'Bookmarked' : 'Add to Bookmarks'}
            >
              <Bookmark className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </form>

        {/* Viewport Toggle (Desktop / Mobile) */}
        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
          <button
            onClick={() => setIsDesktopMode(!isDesktopMode)}
            className={`p-1.5 rounded-lg transition-colors ${
              isDesktopMode ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:text-white'
            }`}
            title={isDesktopMode ? 'Desktop Site View' : 'Mobile Viewport View'}
          >
            {isDesktopMode ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Security or Fail-Closed Notice Banner */}
      {securityNotice && (
        <div className="px-4 py-2 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{securityNotice}</span>
          </div>
          <button onClick={() => setSecurityNotice(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Browser Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col items-center justify-center bg-[#050508]">
        {readerArticle ? (
          <ReaderModeView article={readerArticle} onClose={() => setReaderArticle(null)} />
        ) : (
          <div
            className={`w-full h-full flex flex-col transition-all ${
              isDesktopMode ? 'max-w-full' : 'max-w-[480px] border-x border-white/10 shadow-2xl'
            }`}
          >
            {/* Sandboxed Web Framing / Live Reader Container */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="max-w-md w-full p-6 rounded-2xl bg-[#0b0e17] border border-cyan-500/20 shadow-2xl">
                <Globe className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-pulse" />
                <h3 className="font-mono font-bold text-white text-base mb-2">
                  Sandboxed Web Browser Workspace
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Navigated to <span className="text-cyan-300 font-mono break-all">{activeTab.url}</span> with
                  real-time HTTPS enforcement, ClearURLs parameter stripping, and Tor fail-closed protection.
                </p>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleToggleReaderMode}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-black font-mono font-semibold text-xs hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Open Distraction-Free Reader Mode</span>
                  </button>

                  <a
                    href={activeTab.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-mono text-xs hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open in Native New Window</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
