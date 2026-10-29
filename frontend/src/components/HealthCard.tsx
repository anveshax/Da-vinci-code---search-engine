import React from 'react';
import { Server, Terminal, Cpu, Clock, HardDrive, AlertTriangle } from 'lucide-react';
import { ConnectionState } from '../types/api';

interface HealthCardProps {
  connection: ConnectionState;
}

export const HealthCard: React.FC<HealthCardProps> = ({ connection }) => {
  if (connection.status === 'offline') {
    const is404 = connection.error?.includes('404');
    const isTimeout = connection.error?.toLowerCase().includes('time');
    const cardTitle = is404
      ? 'API Route Not Found (HTTP 404)'
      : isTimeout
        ? 'Connection Timed Out (Cold Starting)'
        : 'Backend Server Offline';

    return (
      <div className="p-5 rounded-xl bg-rose-950/20 border border-rose-500/30 backdrop-blur-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-rose-200">{cardTitle}</h3>
            <p className="text-xs text-rose-400/80">
              {connection.error || 'Unable to connect to backend API server.'}
            </p>
          </div>
        </div>

        {is404 && (
          <div className="bg-obsidian-950/80 rounded-lg p-3 border border-amber-500/30 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-amber-300">Backend responded, but the requested endpoint was not found.</p>
            <p className="text-slate-400 text-[11px]">
              Verify that <code className="text-cyber-cyan">VITE_API_BASE_URL</code> points to the root of your backend (e.g. <code className="text-cyber-cyan">https://da-vinci-code-search-engine.onrender.com</code>) without extra subpaths.
            </p>
          </div>
        )}

        {import.meta.env.DEV && (
          <div className="bg-obsidian-950/80 rounded-lg p-3 border border-surface-border text-xs font-mono space-y-2">
            <p className="text-slate-400 text-[11px]">To start the backend in another terminal:</p>
            <div className="bg-surface-card p-2 rounded text-cyber-cyan select-all">
              backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
            </div>
          </div>
        )}
      </div>
    );
  }

  const telemetry = connection.data?.telemetry;

  return (
    <div className="p-5 rounded-xl bg-surface-card/60 border border-surface-border backdrop-blur-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Backend Telemetry
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Verified host runtime metrics from <code className="text-cyber-cyan">GET /api/health</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Roundtrip:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-bold">
            {connection.latencyMs ?? 0} ms
          </span>
        </div>
      </div>

      {/* Grid of Real Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        {/* Python Version */}
        <div className="p-3 rounded-lg bg-obsidian-950/60 border border-surface-border flex items-center gap-3">
          <Cpu className="w-4 h-4 text-cyber-cyan shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase text-slate-400 block">Python Runtime</span>
            <span className="font-semibold text-slate-200 truncate block">
              {telemetry?.python_version || 'Detecting...'}
            </span>
          </div>
        </div>

        {/* Operating System */}
        <div className="p-3 rounded-lg bg-obsidian-950/60 border border-surface-border flex items-center gap-3">
          <Terminal className="w-4 h-4 text-cyber-violet shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase text-slate-400 block">Host Platform</span>
            <span className="font-semibold text-slate-200 truncate block" title={telemetry?.os_platform}>
              {telemetry?.os_platform || 'Detecting...'}
            </span>
          </div>
        </div>

        {/* Server Uptime */}
        <div className="p-3 rounded-lg bg-obsidian-950/60 border border-surface-border flex items-center gap-3">
          <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase text-slate-400 block">Server Uptime</span>
            <span className="font-semibold text-slate-200 truncate block">
              {telemetry ? `${telemetry.uptime_seconds} s` : '0 s'}
            </span>
          </div>
        </div>

        {/* Process ID */}
        <div className="p-3 rounded-lg bg-obsidian-950/60 border border-surface-border flex items-center gap-3">
          <HardDrive className="w-4 h-4 text-cyber-cyanGlow shrink-0" />
          <div className="overflow-hidden">
            <span className="text-[10px] uppercase text-slate-400 block">Backend Process</span>
            <span className="font-semibold text-slate-200 truncate block">
              PID {telemetry?.process_id || '---'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
