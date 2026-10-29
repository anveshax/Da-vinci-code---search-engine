import React from 'react';
import { RefreshCw, Cpu, Clock } from 'lucide-react';
import { ConnectionState } from '../types/api';

interface NavbarProps {
  connection: ConnectionState;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ connection, onRefresh, isRefreshing }) => {
  const getStatusBadge = () => {
    switch (connection.status) {
      case 'online':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-full text-xs font-mono text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold tracking-wider">ONLINE</span>
            <span className="text-emerald-500/50">|</span>
            <span className="text-emerald-300 font-medium">{connection.latencyMs}ms</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/40 border border-amber-500/30 rounded-full text-xs font-mono text-amber-400">
            <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span className="font-semibold tracking-wider">CONNECTING...</span>
          </div>
        );
      case 'offline':
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-950/40 border border-rose-500/30 rounded-full text-xs font-mono text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            <span className="font-semibold tracking-wider">OFFLINE</span>
            <span className="text-rose-500/50">|</span>
            <span className="text-rose-300">Disconnected</span>
          </div>
        );
    }
  };

  return (
    <header className="h-16 border-b border-surface-border bg-obsidian-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyber-cyan/20 to-cyber-violet/20 border border-cyber-cyan/30 flex items-center justify-center text-cyber-cyan shadow-sm shadow-cyber-cyan/10">
          <Cpu className="w-5 h-5 text-cyber-cyan" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
              Codebase Intelligence Engine
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-card border border-surface-border text-slate-400">
              v0.1.0-alpha
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono tracking-tight">
            High-Performance AST Analysis & Architecture Platform
          </p>
        </div>
      </div>

      {/* Right Controls: Workspace Path + Telemetry Status Pill */}
      <div className="flex items-center gap-4">
        {connection.data?.telemetry.workspace_root && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-card/60 border border-surface-border text-xs text-slate-400 font-mono">
            <span className="text-cyber-cyan text-[10px] uppercase font-bold tracking-wide">Workspace:</span>
            <span className="truncate max-w-[280px] text-slate-300">
              {connection.data.telemetry.workspace_root}
            </span>
          </div>
        )}

        {/* Live Status Badge */}
        {getStatusBadge()}

        {/* Refresh Ping Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Manually ping backend health endpoint"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-surface-border hover:border-surface-borderLight text-xs font-medium text-slate-300 hover:text-white transition-all duration-150 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyber-cyan ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline font-mono">Ping RPC</span>
        </button>
      </div>
    </header>
  );
};
