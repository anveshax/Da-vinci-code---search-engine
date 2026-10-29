import React from 'react';
import {
  LayoutDashboard,
  FolderTree,
  Network,
  Code2,
  GitCompare,
  Mic,
  Layers,
  ChevronRight
} from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  active?: boolean;
}

const MODULES: SidebarItem[] = [
  { id: 'dashboard', label: 'Engine Overview', icon: LayoutDashboard, active: true },
  { id: 'explorer', label: 'Repository Explorer', icon: FolderTree, badge: 'M2' },
  { id: 'graph', label: 'Dependency Graph', icon: Network, badge: 'M3' },
  { id: 'inspector', label: 'Code Inspector', icon: Code2, badge: 'M3' },
  { id: 'impact', label: 'Impact Analysis', icon: GitCompare, badge: 'M4' },
  { id: 'voice', label: 'Voice Assistant', icon: Mic, badge: 'M5' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 border-r border-surface-border bg-obsidian-950/60 flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      {/* Module Navigation List */}
      <div className="p-4 space-y-6">
        <div>
          <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
            <span>Core Modules</span>
            <span className="text-[10px] text-cyber-cyan/70 font-bold">M1 ACTIVE</span>
          </div>
          <nav className="space-y-1">
            {MODULES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  disabled={!item.active}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    item.active
                      ? 'bg-gradient-to-r from-cyber-cyan/15 to-transparent border-l-2 border-cyber-cyan text-slate-100 shadow-sm'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-surface-card/40 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${item.active ? 'text-cyber-cyan' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-card border border-surface-borderLight text-cyber-violet font-semibold">
                      {item.badge}
                    </span>
                  )}
                  {item.active && (
                    <ChevronRight className="w-3.5 h-3.5 text-cyber-cyan" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Engine Architecture Callout */}
        <div className="p-3.5 rounded-xl bg-surface-card/50 border border-surface-border space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Layers className="w-4 h-4 text-cyber-violet" />
            <span>Layer Separation</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            The frontend, FastAPI web layer, and analysis engine remain completely isolated.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-surface-border text-center">
        <p className="text-[10px] font-mono text-slate-400">
          Engine Shell &bull; Milestone 1 Complete
        </p>
      </div>
    </aside>
  );
};
