import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Lock,
  UserCheck,
  Search,
  Plus,
  RefreshCw,
  Cpu,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  GovernancePolicy,
  ApprovalRequest,
  OrganizationalMemoryItem,
  ModelRouterStatus,
  OptimizationReport,
} from '../types/api';
import {
  fetchGovernancePolicies,
  fetchApprovalRequests,
  resolveApprovalRequest,
  queryOrganizationalMemory,
  createOrganizationalMemory,
  fetchModelRouterStatus,
  fetchOptimizationReport,
  actionOptimizationRecommendation,
} from '../services/api';
import { audioService } from '../services/audioService';

interface GovernanceConsoleProps {
  projectId?: string;
}

export const GovernanceConsole: React.FC<GovernanceConsoleProps> = ({ projectId = 'default' }) => {
  const [activeTab, setActiveTab] = useState<'policies' | 'approvals' | 'memory' | 'router' | 'optimization'>('policies');
  const [policies, setPolicies] = useState<GovernancePolicy[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [memories, setMemories] = useState<OrganizationalMemoryItem[]>([]);
  const [routerStatus, setRouterStatus] = useState<ModelRouterStatus | null>(null);
  const [optReport, setOptReport] = useState<OptimizationReport | null>(null);

  const [selectedMemoryType, setSelectedMemoryType] = useState<string>('all');
  const [memorySearch, setMemorySearch] = useState<string>('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [actioningRecId, setActioningRecId] = useState<string | null>(null);

  // New Memory Form State
  const [newMemType, setNewMemType] = useState<'episodic' | 'semantic' | 'procedural' | 'decision'>('procedural');
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemContent, setNewMemContent] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [pols, apps, mems, rStatus, oReport] = await Promise.all([
        fetchGovernancePolicies(false),
        fetchApprovalRequests(),
        queryOrganizationalMemory(
          memorySearch,
          selectedMemoryType === 'all' ? undefined : selectedMemoryType,
          projectId
        ),
        fetchModelRouterStatus().catch(() => null),
        fetchOptimizationReport().catch(() => null),
      ]);
      setPolicies(pols);
      setApprovals(apps);
      setMemories(mems);
      if (rStatus) setRouterStatus(rStatus);
      if (oReport) setOptReport(oReport);
    } catch (err) {
      console.error('Failed to load governance console data:', err);
    }
  }, [memorySearch, selectedMemoryType, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemTitle.trim() || !newMemContent.trim()) return;

    try {
      await createOrganizationalMemory({
        memory_type: newMemType,
        title: newMemTitle.trim(),
        content: newMemContent.trim(),
        created_by: 'administrator',
        project_id: projectId,
        metadata: { manual_entry: true, timestamp: Date.now() },
      });
      audioService.playCompletion();
      setNewMemTitle('');
      setNewMemContent('');
      setIsAddingMemory(false);
      loadData();
    } catch (err) {
      alert('Failed to save memory item: ' + String(err));
    }
  };

  const handleResolveApproval = async (id: string, decision: 'approved' | 'rejected') => {
    try {
      await resolveApprovalRequest(id, decision, `Administrator manual decision: ${decision}`);
      if (decision === 'approved') {
        audioService.playCompletion();
      } else {
        audioService.playError();
      }
      loadData();
    } catch (err) {
      alert(`Failed to ${decision} request: ` + String(err));
    }
  };

  const handleActionRecommendation = async (recId: string, decision: 'approved' | 'rejected') => {
    try {
      setActioningRecId(recId);
      await actionOptimizationRecommendation(recId, decision, 'administrator');
      audioService.playCompletion();
      await loadData();
    } catch (err) {
      alert('Failed to action recommendation: ' + String(err));
    } finally {
      setActioningRecId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050508] text-zinc-100 overflow-y-auto">
      {/* Top Bar */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/80 px-6 py-4 backdrop-blur-md sticky top-0 z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <ShieldCheck className="w-3 h-3" /> ADAPTIVE AI GOVERNANCE OS
              </span>
              <span className="text-xs text-zinc-500">Policies • Approvals • Model Router • Self-Optimization</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-1">
              Autonomous Governance & Telemetry Console
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switcher */}
            <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs">
              <button
                onClick={() => setActiveTab('policies')}
                className={`px-3 py-1.5 font-medium rounded-lg transition-all ${
                  activeTab === 'policies' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Policies ({policies.length})
              </button>
              <button
                onClick={() => setActiveTab('approvals')}
                className={`px-3 py-1.5 font-medium rounded-lg transition-all ${
                  activeTab === 'approvals' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Approvals ({approvals.filter((a) => a.status === 'pending').length} Pending)
              </button>
              <button
                onClick={() => setActiveTab('memory')}
                className={`px-3 py-1.5 font-medium rounded-lg transition-all ${
                  activeTab === 'memory' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Org Memory ({memories.length})
              </button>
              <button
                onClick={() => setActiveTab('router')}
                className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'router' ? 'bg-sky-500/20 text-sky-300 shadow-sm border border-sky-500/30' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span>Model Router 2.0</span>
              </button>
              <button
                onClick={() => setActiveTab('optimization')}
                className={`px-3 py-1.5 font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'optimization' ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Self-Optimization</span>
              </button>
            </div>

            <button
              onClick={() => loadData()}
              className="p-2 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Tab 1: Policies */}
        {activeTab === 'policies' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>Authoritative policies enforced across all agents, tools, and outbound network traffic.</span>
              <span className="font-mono text-emerald-400">Policy Guard Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((pol) => {
                const isDeny = pol.action_type === 'DENY';
                const isApproval = pol.action_type === 'REQUIRE_APPROVAL';
                return (
                  <div
                    key={pol.id}
                    className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded-lg ${
                              isDeny
                                ? 'bg-rose-500/10 text-rose-400'
                                : isApproval
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            <Lock className="w-4 h-4" />
                          </span>
                          <h3 className="text-sm font-bold text-white">{pol.name}</h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            isDeny
                              ? 'bg-rose-500/20 text-rose-300'
                              : isApproval
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {pol.action_type}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{pol.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <span>Action: <code className="text-zinc-300">{pol.target_action}</code></span>
                      <span className="uppercase text-zinc-400">Risk: {pol.risk_level}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Approvals */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span>Human administrator sign-off ledger for high-risk actions.</span>
              <span>Audited Interventions</span>
            </div>

            {approvals.length > 0 ? (
              <div className="space-y-3">
                {approvals.map((req) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isPending
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : isApproved
                          ? 'bg-zinc-900/60 border-zinc-800'
                          : 'bg-rose-950/20 border-rose-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded-lg ${
                              isPending
                                ? 'bg-amber-500/20 text-amber-400'
                                : isApproved
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            <UserCheck className="w-4 h-4" />
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-white">Action: {req.action_requested}</h4>
                            <span className="text-[10px] text-zinc-400">
                              Agent: <code className="text-zinc-300">{req.agent_id}</code> • Task: {req.task_id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300">
                            Risk: {req.risk_score}/100
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isPending
                                ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                                : isApproved
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-300 mt-2">{req.risk_explanation}</p>

                      <div className="mt-2.5 p-2 rounded bg-zinc-950/60 border border-zinc-800/80 font-mono text-[11px] text-zinc-400 truncate">
                        Payload: {JSON.stringify(req.parameters)}
                      </div>

                      {isPending && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20 flex justify-end gap-2">
                          <button
                            onClick={() => handleResolveApproval(req.id, 'rejected')}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Deny Action
                          </button>
                          <button
                            onClick={() => handleResolveApproval(req.id, 'approved')}
                            className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Approve Action
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-900/30 rounded-xl border border-zinc-800">
                No approval requests currently recorded.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Organizational Memory */}
        {activeTab === 'memory' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Filter Memory Type:</span>
                <select
                  value={selectedMemoryType}
                  onChange={(e) => setSelectedMemoryType(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded px-2.5 py-1 focus:outline-none focus:border-zinc-700"
                >
                  <option value="all">All Types ({memories.length})</option>
                  <option value="procedural">Procedural (Runbooks)</option>
                  <option value="semantic">Semantic (Architecture)</option>
                  <option value="decision">Decision (Governance)</option>
                  <option value="episodic">Episodic (Task History)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search memories..."
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={() => setIsAddingMemory(!isAddingMemory)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Memory
                </button>
              </div>
            </div>

            {/* Add Memory Modal / Box */}
            {isAddingMemory && (
              <form
                onSubmit={handleCreateMemory}
                className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-700 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">Add Shared Organizational Knowledge</h4>
                  <select
                    value={newMemType}
                    onChange={(e) => setNewMemType(e.target.value as any)}
                    className="bg-zinc-800 border border-zinc-700 text-xs text-white rounded px-2 py-1"
                  >
                    <option value="procedural">Procedural (Runbook)</option>
                    <option value="semantic">Semantic (Architecture)</option>
                    <option value="decision">Decision (Governance)</option>
                    <option value="episodic">Episodic (Task History)</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Title / Topic..."
                  value={newMemTitle}
                  onChange={(e) => setNewMemTitle(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                <textarea
                  placeholder="Memory content, guidelines, or verified procedure..."
                  value={newMemContent}
                  onChange={(e) => setNewMemContent(e.target.value)}
                  rows={3}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingMemory(false)}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg"
                  >
                    Save Memory
                  </button>
                </div>
              </form>
            )}

            {/* Memories List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-emerald-400">
                        {mem.memory_type}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(mem.created_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-white">{mem.title}</h3>
                    <p className="text-xs text-zinc-300 mt-2 leading-relaxed line-clamp-4">{mem.content}</p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                    <span>Source: <code className="text-zinc-400">{mem.created_by}</code></span>
                    <span className="truncate max-w-[150px]">{JSON.stringify(mem.metadata)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Intelligent Model Router 2.0 */}
        {activeTab === 'router' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Dynamic multi-factor model selection engine with live latency telemetry and context scoring.</span>
              <span className="px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono">
                Primary: {routerStatus?.primary_provider?.toUpperCase() || 'GEMINI'}
              </span>
            </div>

            {/* Capability Matrix Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routerStatus && Object.entries(routerStatus.capability_matrix).map(([pid, cap]) => {
                const isPrimary = routerStatus.primary_provider === pid;
                const configured = routerStatus.configured_providers.find((p) => p.id === pid);
                return (
                  <div
                    key={pid}
                    className={`p-5 rounded-2xl border transition-all ${
                      isPrimary
                        ? 'bg-[#0B1220] border-sky-500/40 shadow-lg'
                        : 'bg-zinc-900/50 border-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${isPrimary ? 'bg-sky-500/20 text-sky-400' : 'bg-zinc-800 text-zinc-400'}`}>
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white uppercase">{pid}</h3>
                          <span className="text-[11px] text-zinc-400">{cap.description}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        configured?.configured ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {configured?.configured ? 'Available' : 'Unconfigured'}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-zinc-800/80 text-center font-mono">
                      <div className="p-2 rounded-lg bg-black/40">
                        <span className="block text-[10px] text-zinc-500">Reasoning</span>
                        <span className="text-xs font-bold text-sky-400">{cap.reasoning}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40">
                        <span className="block text-[10px] text-zinc-500">Coding</span>
                        <span className="text-xs font-bold text-emerald-400">{cap.coding}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40">
                        <span className="block text-[10px] text-zinc-500">Speed</span>
                        <span className="text-xs font-bold text-amber-400">{cap.speed}%</span>
                      </div>
                      <div className="p-2 rounded-lg bg-black/40">
                        <span className="block text-[10px] text-zinc-500">Context</span>
                        <span className="text-xs font-bold text-purple-400">{cap.context_window > 500000 ? '1M' : `${cap.context_window / 1000}k`}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 5: Self-Optimization & Health Engine */}
        {activeTab === 'optimization' && optReport && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Controlled platform optimization engine. Proposes workflow and prompt enhancements.</span>
              <span className="font-mono text-emerald-400">Health: {optReport.status.toUpperCase()}</span>
            </div>

            {/* Governance Safeguard Alert Banner */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-amber-300 block mb-0.5">Strict Human Governance Guardrail</span>
                <p className="text-amber-200/90 leading-relaxed">{optReport.governance_safeguard}</p>
              </div>
            </div>

            {/* Execution Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[11px] text-zinc-500 font-mono">Total Multi-Agent Tasks</span>
                <span className="text-2xl font-bold text-white block mt-1">{optReport.execution_metrics.total_tasks}</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[11px] text-zinc-500 font-mono">Completed Tasks</span>
                <span className="text-2xl font-bold text-emerald-400 block mt-1">{optReport.execution_metrics.completed_tasks}</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[11px] text-zinc-500 font-mono">Failed Tasks</span>
                <span className="text-2xl font-bold text-rose-400 block mt-1">{optReport.execution_metrics.failed_tasks}</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <span className="text-[11px] text-zinc-500 font-mono">Overall Success Rate</span>
                <span className="text-2xl font-bold text-sky-400 block mt-1">{optReport.execution_metrics.overall_success_rate}</span>
              </div>
            </div>

            {/* Active Optimization Recommendations */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Actionable Recommendations ({optReport.active_recommendations.length})</span>
              </h3>

              <div className="space-y-3">
                {optReport.active_recommendations.map((rec) => {
                  const isPending = rec.status === 'pending_review';
                  const isApproved = rec.status === 'approved';
                  return (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isApproved
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : isPending
                          ? 'bg-[#0B111E] border-sky-500/30'
                          : 'bg-zinc-900/40 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            rec.impact_level === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {rec.impact_level} impact
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono uppercase">{rec.category}</span>
                          <h4 className="text-xs font-bold text-white">{rec.title}</h4>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isApproved ? 'bg-emerald-500/20 text-emerald-400' : isPending ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {rec.status.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 mt-2 leading-relaxed">{rec.description}</p>

                      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                        <span>Evidence: {JSON.stringify(rec.metric_evidence)}</span>

                        {isPending && (
                          <div className="flex items-center gap-2">
                            <button
                              disabled={actioningRecId === rec.id}
                              onClick={() => handleActionRecommendation(rec.id, 'rejected')}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                            >
                              Reject
                            </button>
                            <button
                              disabled={actioningRecId === rec.id}
                              onClick={() => handleActionRecommendation(rec.id, 'approved')}
                              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                            >
                              Authorize & Apply
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
