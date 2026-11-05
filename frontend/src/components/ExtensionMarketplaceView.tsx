import React, { useState, useEffect } from 'react';
import {
  Blocks,
  Shield,
  Download,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw,
  Power,
  X,
  Lock,
} from 'lucide-react';
import {
  fetchCuratedExtensions,
  installMarketplaceExtension,
  uninstallMarketplaceExtension,
  toggleMarketplaceExtension,
} from '../services/api';
import { CuratedExtension } from '../types/api';

export const ExtensionMarketplaceView: React.FC = () => {
  const [extensions, setExtensions] = useState<CuratedExtension[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [permissionModalExt, setPermissionModalExt] = useState<CuratedExtension | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadExtensions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCuratedExtensions();
      setExtensions(data);
    } catch (err) {
      console.error('Failed to load extensions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExtensions();
  }, []);

  const handleInstallClick = (ext: CuratedExtension) => {
    // ANVESHA security policy: Require explicit user review of extension permissions
    setPermissionModalExt(ext);
  };

  const handleConfirmInstall = async () => {
    if (!permissionModalExt) return;
    const extId = permissionModalExt.id;
    setActionInProgress(extId);
    try {
      await installMarketplaceExtension(extId);
      await loadExtensions();
    } finally {
      setActionInProgress(null);
      setPermissionModalExt(null);
    }
  };

  const handleUninstall = async (extId: string) => {
    setActionInProgress(extId);
    try {
      await uninstallMarketplaceExtension(extId);
      await loadExtensions();
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggle = async (extId: string) => {
    setActionInProgress(extId);
    try {
      await toggleMarketplaceExtension(extId);
      await loadExtensions();
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050508] text-slate-200 p-4 sm:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Blocks className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold font-mono tracking-tight text-white">
              ANVESHA EXTENSION MARKETPLACE
            </h1>
          </div>
          <p className="text-sm text-slate-400 font-sans">
            Curated, sandboxed privacy and productivity extensions with permission audit and zero tracking.
          </p>
        </div>

        <button
          onClick={loadExtensions}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-mono transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : 'text-slate-300'}`} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* Extension Cards Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {extensions.map((ext) => {
          const isInstalled = ext.installed ?? false;
          const isEnabled = ext.enabled ?? false;
          const isProcessing = actionInProgress === ext.id;

          return (
            <div
              key={ext.id}
              className={`flex flex-col justify-between p-5 rounded-2xl bg-[#0b0e17] border transition-all ${
                isEnabled
                  ? 'border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.08)]'
                  : 'border-white/10 opacity-80 hover:opacity-100'
              }`}
            >
              <div>
                {/* Title & Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-mono font-semibold text-white text-base">{ext.name}</h3>
                    <div className="text-[11px] text-slate-400 font-mono">v{ext.version} • By {ext.author}</div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                      ext.category === 'Privacy'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : ext.category === 'Security'
                        ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                    }`}
                  >
                    {ext.category}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mb-4 line-clamp-3 leading-relaxed">
                  {ext.description}
                </p>

                {/* Permissions Badges */}
                <div className="mb-4">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Permissions ({ext.permissions?.length || 0})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ext.permissions?.map((p, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                {isInstalled ? (
                  <>
                    <button
                      onClick={() => handleToggle(ext.id)}
                      disabled={isProcessing}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                        isEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </button>

                    <button
                      onClick={() => handleUninstall(ext.id)}
                      disabled={isProcessing}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Uninstall extension"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleInstallClick(ext)}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 text-xs font-mono font-semibold transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install Extension</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Permission Review Modal */}
      {permissionModalExt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-[#0b0e17] border border-purple-500/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2 text-purple-400 font-mono font-semibold text-sm">
                <Shield className="w-4 h-4" />
                <span>EXTENSION PERMISSION AUDIT</span>
              </div>
              <button
                onClick={() => setPermissionModalExt(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <h3 className="font-mono font-bold text-white text-base mb-1">
                Install {permissionModalExt.name}?
              </h3>
              <p className="text-xs text-slate-400">
                ANVESHA requires explicit user authorization before granting web sandboxing and network filter permissions.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-6">
              <div className="text-xs font-mono text-purple-300 font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Requested Sandboxed Permissions:</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                {permissionModalExt.permissions.map((p, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setPermissionModalExt(null)}
                className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 text-xs font-mono hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmInstall}
                className="px-4 py-2 rounded-lg bg-purple-500 text-white text-xs font-mono font-bold hover:bg-purple-400 transition-colors shadow-lg shadow-purple-500/20 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Authorize & Install</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
