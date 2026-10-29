import React from 'react';
import {
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Code,
  GitBranch,
  Cpu
} from 'lucide-react';

interface DashboardEmptyStateProps {
  onPing: () => void;
  isPinging: boolean;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({ onPing, isPinging }) => {
  return (
    <div className="space-y-6">
      {/* Hero Empty Workspace State */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-surface-card to-obsidian-950 border border-surface-border p-8 md:p-12 text-center">
        {/* Futuristic Accent Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-cyber-cyan/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-64 h-32 bg-cyber-violet/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          {/* Hologram-style Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Milestone 1 Application Shell Active</span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Codebase Ingestion Standby
          </h2>

          {/* Description */}
          <p className="text-sm text-slate-300 leading-relaxed">
            The frontend shell and FastAPI communication layer are established.
            In <span className="text-cyber-cyan font-semibold">Milestone 2</span>, the decoupled
            analysis engine will index directory file trees, parse Abstract Syntax Trees (AST),
            and generate module dependency graphs.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={onPing}
              disabled={isPinging}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyber-cyan hover:bg-cyber-cyanGlow text-obsidian-950 text-xs font-bold font-mono tracking-wide transition-all shadow-lg shadow-cyber-cyan/20 disabled:opacity-60"
            >
              <Cpu className="w-4 h-4" />
              <span>{isPinging ? 'Pinging RPC...' : 'Test Backend Connection'}</span>
            </button>

            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-surface-border text-xs font-medium text-slate-200 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-cyber-violet" />
              <span>Explore OpenAPI /docs</span>
            </a>
          </div>
        </div>
      </div>

      {/* Feature Architecture Cards (Genuinely labeled with milestones) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: AST Parsing */}
        <div className="p-5 rounded-xl bg-surface-card/40 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-cyber-cyan/10 text-cyber-cyan">
              <Code className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-card border border-surface-borderLight text-slate-400">
              Milestone 2
            </span>
          </div>
          <h4 className="text-sm font-semibold text-slate-200">AST & Symbol Parser</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Extracts classes, function definitions, docstrings, and import graphs using Python's native AST parser.
          </p>
        </div>

        {/* Card 2: Interactive Graphs */}
        <div className="p-5 rounded-xl bg-surface-card/40 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-cyber-violet/10 text-cyber-violet">
              <GitBranch className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-card border border-surface-borderLight text-slate-400">
              Milestone 3
            </span>
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Interactive Visual Graph</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Renders interactive node-edge diagrams mapping dependencies, call hierarchies, and architectural layers.
          </p>
        </div>

        {/* Card 3: System Decoupling */}
        <div className="p-5 rounded-xl bg-surface-card/40 border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
              Active in M1
            </span>
          </div>
          <h4 className="text-sm font-semibold text-slate-200">Decoupled Architecture</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Analysis engine operates strictly independently of the web framework, ensuring clean testing and modularity.
          </p>
        </div>
      </div>
    </div>
  );
};
