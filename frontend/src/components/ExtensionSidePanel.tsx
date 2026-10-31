import React, { useState, useEffect, useCallback } from 'react';
import {
  Blocks,
  X,
  Minimize2,
  Maximize2,
  Check,
  AlertCircle,
  Shield,
  Download,
  Trash2,
  ToggleLeft,
  ToggleRight,
  GitBranch,
  RefreshCw,
  HardDrive,
  FileCode2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ExtensionRecord } from '../types/extension';
import { extensionRegistry } from '../services/extensionRegistry';

interface ExtensionSidePanelProps {
  isOpen: boolean;
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
}

export const ExtensionSidePanel: React.FC<ExtensionSidePanelProps> = ({
  isOpen,
  isMinimized,
  onClose,
  onToggleMinimize,
}) => {
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'launcher' | 'active'>('launcher');
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sample Extension state: Git Metrics widget
  const [gitMetrics, setGitMetrics] = useState<{
    commitsCount: number;
    activeBranches: number;
    velocityScore: number;
    lastSynced: string;
  }>({
    commitsCount: 128,
    activeBranches: 4,
    velocityScore: 94,
    lastSynced: 'Just now',
  });
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState<boolean>(false);

  const loadExtensions = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await extensionRegistry.fetchExtensions();
      setExtensions(list);

      // If an extension is enabled and marked visible, auto-select it if none selected
      const visibleExt = list.find((e) => e.enabled && e.visible);
      if (visibleExt && !selectedExtensionId) {
        setSelectedExtensionId(visibleExt.id);
        setActiveTab('active');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load extensions');
    } finally {
      setIsLoading(false);
    }
  }, [selectedExtensionId]);

  useEffect(() => {
    if (isOpen) {
      loadExtensions();
    }
  }, [isOpen, loadExtensions]);

  const handleInstall = async (id: string) => {
    try {
      await extensionRegistry.installExtension(id);
      await loadExtensions();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleUninstall = async (id: string) => {
    try {
      await extensionRegistry.uninstallExtension(id);
      if (selectedExtensionId === id) {
        setSelectedExtensionId(null);
        setActiveTab('launcher');
      }
      await loadExtensions();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleToggleEnable = async (ext: ExtensionRecord) => {
    try {
      if (ext.enabled) {
        await extensionRegistry.disableExtension(ext.id);
        if (selectedExtensionId === ext.id) {
          setActiveTab('launcher');
        }
      } else {
        await extensionRegistry.enableExtension(ext.id);
      }
      await loadExtensions();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleOpenExtension = async (ext: ExtensionRecord) => {
    if (!ext.enabled) return;
    try {
      await extensionRegistry.setVisibility(ext.id, true);
      setSelectedExtensionId(ext.id);
      setActiveTab('active');
      await loadExtensions();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRefreshGitMetrics = async () => {
    setIsRefreshingMetrics(true);
    try {
      // Simulate reading and persisting in isolated extension storage
      if (selectedExtensionId) {
        const nextVal = {
          commitsCount: gitMetrics.commitsCount + 1,
          activeBranches: gitMetrics.activeBranches,
          velocityScore: Math.min(100, gitMetrics.velocityScore + 1),
          lastSynced: new Date().toLocaleTimeString(),
        };
        await extensionRegistry.setStorage(selectedExtensionId, 'metrics', nextVal);
        setGitMetrics(nextVal);
      }
    } catch (err: any) {
      console.warn('Storage write notice:', err);
    } finally {
      setTimeout(() => setIsRefreshingMetrics(false), 400);
    }
  };

  if (!isOpen) return null;

  // Minimized floating dock pill
  if (isMinimized) {
    return (
      <aside
        aria-label="Extensions Minimized Panel"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center bg-[#0B0F19] border-l border-y border-[#232B3E] rounded-l-2xl shadow-2xl p-2 cursor-pointer hover:border-sky-500/50 transition-all text-slate-300 hover:text-white"
        onClick={onToggleMinimize}
        title="Expand Anvesha Extension Drawer"
      >
        <div className="flex flex-col items-center gap-2">
          <Blocks className="w-5 h-5 text-sky-400 animate-pulse" />
          <span className="text-[10px] font-mono [writing-mode:vertical-rl] tracking-wider text-slate-400 uppercase font-semibold">
            Extensions
          </span>
          <Maximize2 className="w-3.5 h-3.5 text-slate-500 mt-1" />
        </div>
      </aside>
    );
  }

  const selectedExtension = extensions.find((e) => e.id === selectedExtensionId);
  const enabledCount = extensions.filter((e) => e.enabled).length;

  return (
    <aside
      aria-label="Extensions Side Panel"
      className="fixed right-0 top-14 bottom-0 w-full sm:w-96 z-40 bg-[#07090F]/95 backdrop-blur-xl border-l border-[#1A2030] shadow-2xl flex flex-col font-sans transition-all animate-fade-in"
    >
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-[#1A2030] flex items-center justify-between shrink-0 bg-[#0B0F19]/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Blocks className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white tracking-wide flex items-center gap-2">
              Extension Platform
              <span className="px-1.5 py-0.2 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">
                SDK v1.0
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {enabledCount} active {enabledCount === 1 ? 'module' : 'modules'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Minimize drawer to right edge"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Close extension drawer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-2.5 flex items-center gap-2 border-b border-[#1A2030] bg-[#090C15]/40 text-xs">
        <button
          onClick={() => setActiveTab('launcher')}
          className={`pb-2 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'launcher'
              ? 'border-sky-400 text-sky-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Blocks className="w-3.5 h-3.5" />
          Registry & Tools ({extensions.length})
        </button>

        {selectedExtension && selectedExtension.enabled && (
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-2 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'border-sky-400 text-sky-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {selectedExtension.manifest.sidePanel?.title || selectedExtension.name}
          </button>
        )}
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="m-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Operation Error</p>
            <p className="text-[11px] text-rose-400/90">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans">
        {activeTab === 'launcher' ? (
          /* Tab 1: Registry Launcher */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>Available Extensions</span>
              <button
                onClick={loadExtensions}
                className="hover:text-white flex items-center gap-1 text-[11px]"
                title="Refresh registry list"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {extensions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#1E2638] rounded-2xl bg-white/[0.01]">
                <Blocks className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-300 font-medium">No Extensions Registered</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  Register custom extensions via the Anvesha Extension SDK to extend developer workflows.
                </p>
              </div>
            ) : (
              extensions.map((ext) => {
                const isSelected = selectedExtensionId === ext.id;
                return (
                  <div
                    key={ext.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-[#0F1424] border-sky-500/40 shadow-lg shadow-sky-500/5'
                        : 'bg-[#0A0D18] border-[#1A2030] hover:border-[#2A344C]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-mono text-xs font-bold">
                          {ext.manifest.sidePanel?.icon === 'GitBranch' ? (
                            <GitBranch className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <FileCode2 className="w-4 h-4 text-sky-400" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-white leading-tight">
                            {ext.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            v{ext.version} • {ext.manifest.author || 'Community'}
                          </span>
                        </div>
                      </div>

                      {/* State Badges */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                            ext.installed
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {ext.installed ? 'Installed' : 'Uninstalled'}
                        </span>
                        {ext.installed && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                              ext.enabled
                                ? 'bg-sky-950/40 text-sky-300 border-sky-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {ext.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                      {ext.manifest.description}
                    </p>

                    {/* Declared Permissions Badges */}
                    {ext.manifest.permissions && ext.manifest.permissions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {ext.manifest.permissions.map((p) => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-slate-400 flex items-center gap-1"
                          >
                            <Shield className="w-2.5 h-2.5 text-sky-400" />
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                      {!ext.installed ? (
                        <button
                          onClick={() => handleInstall(ext.id)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Install Extension
                        </button>
                      ) : (
                        <div className="flex items-center justify-between w-full gap-2">
                          {/* Enable/Disable Toggle */}
                          <button
                            onClick={() => handleToggleEnable(ext)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-colors ${
                              ext.enabled
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                            title={ext.enabled ? 'Click to disable' : 'Click to enable'}
                          >
                            {ext.enabled ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-sky-400" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-slate-500" />
                                <span>Inactive</span>
                              </>
                            )}
                          </button>

                          {/* Open in side panel */}
                          {ext.enabled && (
                            <button
                              onClick={() => handleOpenExtension(ext)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white font-mono flex items-center gap-1 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                              <span>Open</span>
                            </button>
                          )}

                          {/* Uninstall */}
                          <button
                            onClick={() => handleUninstall(ext.id)}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                            title="Uninstall extension"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Tab 2: Active Extension Sandbox View */
          selectedExtension && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-3.5 rounded-2xl bg-[#0F1422] border border-[#1E2638]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      {selectedExtension.manifest.sidePanel?.title || selectedExtension.name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1">
                    <Check className="w-2.5 h-2.5 text-emerald-400" /> Sandboxed
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {selectedExtension.manifest.description}
                </p>
              </div>

              {/* Functional Sample Widget (Git Metrics) */}
              <div className="p-4 rounded-2xl bg-[#0A0D18] border border-[#1A2030] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Repository Telemetry
                  </span>
                  <button
                    onClick={handleRefreshGitMetrics}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Refresh metrics & sync isolated storage"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingMetrics ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-[#0F1424] border border-white/5">
                    <span className="text-xl font-bold font-mono text-white block">
                      {gitMetrics.commitsCount}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Weekly Commits</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0F1424] border border-white/5">
                    <span className="text-xl font-bold font-mono text-sky-400 block">
                      {gitMetrics.velocityScore}%
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Velocity Index</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                    Isolated Storage
                  </span>
                  <span className="text-emerald-400">Encrypted / Key-Value</span>
                </div>

                <div className="text-[10px] text-slate-500 font-mono text-right">
                  Synced: {gitMetrics.lastSynced}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </aside>
  );
};
