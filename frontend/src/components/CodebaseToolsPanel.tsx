import React, { useState, useEffect } from 'react';
import {
  Network,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowRight,
  Flame,
} from 'lucide-react';
import {
  fetchDependencyGraph,
  fetchChangeImpact,
  fetchTestGaps,
  fetchSecurityInsights,
} from '../services/api';
import {
  DependencyGraphData,
  ImpactAnalysisData,
  TestGapsData,
  SecurityInsightsData,
} from '../types/api';

interface CodebaseToolsPanelProps {
  onOpenFile: (filePath: string, line?: number) => void;
}

export const CodebaseToolsPanel: React.FC<CodebaseToolsPanelProps> = ({ onOpenFile }) => {
  const [activeTab, setActiveTab] = useState<'deps' | 'impact' | 'testgaps' | 'security'>('deps');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [depsData, setDepsData] = useState<DependencyGraphData | null>(null);
  const [testGapsData, setTestGapsData] = useState<TestGapsData | null>(null);
  const [securityData, setSecurityData] = useState<SecurityInsightsData | null>(null);

  // Impact analysis target file
  const [impactInput, setImpactInput] = useState<string>('backend/app/core/config.py');
  const [impactResult, setImpactResult] = useState<ImpactAnalysisData | null>(null);
  const [isImpactLoading, setIsImpactLoading] = useState<boolean>(false);

  // Filter for dependency list
  const [depFilter, setDepFilter] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [deps, gaps, sec] = await Promise.all([
        fetchDependencyGraph(),
        fetchTestGaps(),
        fetchSecurityInsights(),
      ]);
      setDepsData(deps);
      setTestGapsData(gaps);
      setSecurityData(sec);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load codebase intelligence metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunImpact = async (target?: string) => {
    const file = target || impactInput;
    if (!file.trim()) return;
    setIsImpactLoading(true);
    try {
      const result = await fetchChangeImpact(file.trim());
      setImpactResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impact analysis failed');
    } finally {
      setIsImpactLoading(false);
    }
  };

  const filteredDeps = (depsData?.nodes || []).filter(
    (n) => n.path.toLowerCase().includes(depFilter.toLowerCase())
  );

  return (
    <div className="bg-[#090D16] border border-[#1E2638] rounded-2xl overflow-hidden shadow-2xl">
      {/* Panel Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#1E2638] px-5 py-3.5 bg-[#0C121E] gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('deps')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'deps'
                ? 'bg-sky-500/15 border border-sky-400/40 text-sky-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-sky-400" />
            <span>Dependency Graph</span>
          </button>

          <button
            onClick={() => setActiveTab('impact')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'impact'
                ? 'bg-amber-500/15 border border-amber-400/40 text-amber-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Change Impact</span>
          </button>

          <button
            onClick={() => setActiveTab('testgaps')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'testgaps'
                ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Gap Analysis</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
              activeTab === 'security'
                ? 'bg-rose-500/15 border border-rose-400/40 text-rose-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
            <span>Security Insights</span>
            {securityData && securityData.total_findings > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 text-[10px] font-bold">
                {securityData.total_findings}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          title="Refresh Codebase Metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border-b border-rose-900/40 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Dependency Graph */}
      {activeTab === 'deps' && (
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Module Dependency Map</h3>
              <p className="text-xs text-slate-400">
                Found {depsData?.total_nodes || 0} modules with {depsData?.total_edges || 0} import connections
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter files..."
                value={depFilter}
                onChange={(e) => setDepFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0F1523] border border-[#232B3E] text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredDeps.map((node) => (
              <div
                key={node.id}
                className="p-3 rounded-xl bg-[#0F1422] border border-[#1E273A] hover:border-sky-500/40 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate">
                    <button
                      onClick={() => onOpenFile(node.path, 1)}
                      className="text-xs font-bold font-mono text-white hover:text-sky-300 truncate text-left block"
                      title={node.path}
                    >
                      {node.label}
                    </button>
                    <div className="text-[10px] font-mono text-slate-500 truncate">{node.path}</div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400 shrink-0 uppercase">
                    {node.extension.slice(1) || 'file'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-white/5">
                  <span>{node.lines} lines</span>
                  <div className="flex items-center gap-2">
                    <span title="Outgoing dependencies (imports)" className="text-sky-400">
                      &uarr; {node.dependencies_out}
                    </span>
                    <span title="Incoming dependents (imported by)" className="text-purple-400">
                      &darr; {node.dependencies_in}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Change Impact Analysis */}
      {activeTab === 'impact' && (
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Blast Radius & Change Impact Inspector</h3>
            <p className="text-xs text-slate-400">
              Calculate which components, routes, and tests break if you edit a target module.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={impactInput}
              onChange={(e) => setImpactInput(e.target.value)}
              placeholder="e.g. backend/app/core/config.py or src/components/SearchBar.tsx"
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#0F1523] border border-[#232B3E] text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-amber-400"
            />
            <button
              onClick={() => handleRunImpact()}
              disabled={isImpactLoading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs font-mono transition-colors disabled:opacity-50"
            >
              {isImpactLoading ? 'Analyzing...' : 'Analyze Impact'}
            </button>
          </div>

          {impactResult && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-4 p-3.5 rounded-xl bg-[#0F1523] border border-[#232B3E]">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">Impact Risk</div>
                  <div className={`text-sm font-bold font-mono uppercase ${
                    impactResult.impact_risk === 'critical' ? 'text-rose-400' :
                    impactResult.impact_risk === 'medium' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {impactResult.impact_risk} Risk
                  </div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">Total Affected Files</div>
                  <div className="text-sm font-bold font-mono text-white">
                    {impactResult.total_affected} files
                  </div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">Direct Dependents</div>
                  <div className="text-sm font-bold font-mono text-sky-400">
                    {impactResult.direct_dependents.length}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                <div className="text-xs font-mono text-slate-400 mb-1">Affected Modules in Dependency Chain:</div>
                {impactResult.affected_details.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#0F1420] border border-[#1C2538] text-xs font-mono"
                  >
                    <button
                      onClick={() => onOpenFile(item.file, 1)}
                      className="text-left font-medium text-slate-200 hover:text-amber-300 truncate"
                    >
                      {item.file}
                    </button>
                    <span className={`px-2 py-0.5 rounded text-[10px] shrink-0 ${
                      item.is_direct ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-400'
                    }`}>
                      {item.is_direct ? 'Direct Dependent' : `Transitive (Depth ${item.distance})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Test Gap Analysis */}
      {activeTab === 'testgaps' && (
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Test Coverage Gap Detection</h3>
              <p className="text-xs text-slate-400">
                Correlates production source files with test suites to uncover blind spots.
              </p>
            </div>
            {testGapsData && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-slate-400">
                  Coverage: <strong className="text-emerald-400">{testGapsData.coverage_percentage}%</strong>
                </span>
                <span className="text-slate-400">
                  Untested: <strong className="text-rose-400">{testGapsData.untested_modules}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {(testGapsData?.gaps || []).map((gap, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0F1420] border border-[#1C2538] hover:border-emerald-500/40 transition-all text-xs font-mono"
              >
                <div className="truncate mr-3">
                  <button
                    onClick={() => onOpenFile(gap.file, 1)}
                    className="font-bold text-white hover:text-emerald-300 truncate text-left block"
                  >
                    {gap.file}
                  </button>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {gap.lines} lines &bull; {gap.symbols_count} symbols
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                    gap.criticality === 'high'
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                      : 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                  }`}>
                    {gap.criticality} priority
                  </span>
                  <button
                    onClick={() => onOpenFile(gap.file, 1)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    title="Inspect file"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Security Insights */}
      {activeTab === 'security' && (
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Static Security & Vulnerability Analysis</h3>
            <p className="text-xs text-slate-400">
              Scans for hardcoded tokens, dynamic execution, injection patterns, and insecure APIs.
            </p>
          </div>

          {securityData && securityData.findings.length === 0 ? (
            <div className="p-8 text-center bg-[#0F1420] rounded-xl border border-[#1C2538]">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-white">No Critical Security Vulnerabilities Detected</div>
              <div className="text-xs text-slate-400 mt-1">
                Scanned all workspace modules. Zero plain-text credentials or unsafe execution functions found.
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {(securityData?.findings || []).map((finding, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#0F1420] border border-[#1C2538] hover:border-rose-500/40 transition-all space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      {finding.rule}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {finding.severity}
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenFile(finding.file, finding.line)}
                    className="text-left text-slate-300 hover:text-white underline underline-offset-2"
                  >
                    {finding.file}:{finding.line}
                  </button>

                  <div className="p-2 rounded bg-black/50 border border-white/5 text-[11px] text-slate-300 overflow-x-auto">
                    <code>{finding.snippet}</code>
                  </div>

                  <div className="text-[11px] text-emerald-400">
                    <strong>Remedy:</strong> {finding.recommendation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
