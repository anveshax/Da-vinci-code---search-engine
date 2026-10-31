import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Shield,
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  FileCode,
  Globe,
  Database,
  UserCheck,
  Activity,
  Layers,
  FileText
} from 'lucide-react';
import {
  AgentRecord,
  MultiAgentTaskRecord,
  TaskStepRecord,
  ApprovalRequest,
  AgentMessageLog,
} from '../types/api';
import {
  fetchAgents,
  createMultiAgentTask,
  fetchMultiAgentTasks,
  fetchMultiAgentTask,
  resumeMultiAgentTask,
  fetchApprovalRequests,
  resolveApprovalRequest,
  fetchAuditLogs,
  getApiBaseUrl,
} from '../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { audioService } from '../services/audioService';

interface MultiAgentWorkspaceProps {
  projectId?: string;
  onNavigateHome?: () => void;
}

const PRESET_GOALS = [
  'Research a technology, compare available approaches, create a report and prepare a presentation.',
  'Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report.',
  'Scan codebase dependencies, detect test coverage gaps, and propose architecture refactoring.',
  'Audit external HTTP endpoints and verify anti-SSRF protections across all services.',
];

export const MultiAgentWorkspace: React.FC<MultiAgentWorkspaceProps> = ({
  projectId = 'default',
}) => {
  const [goal, setGoal] = useState('');
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [tasks, setTasks] = useState<MultiAgentTaskRecord[]>([]);
  const [activeTask, setActiveTask] = useState<MultiAgentTaskRecord | null>(null);
  const [activeSteps, setActiveSteps] = useState<TaskStepRecord[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AgentMessageLog[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'report' | 'dag' | 'audit'>('report');

  const eventSourceRef = useRef<EventSource | null>(null);

  // Load agents & past tasks on mount
  const loadInitialData = useCallback(async () => {
    try {
      const [agentList, taskList, approvalList] = await Promise.all([
        fetchAgents(),
        fetchMultiAgentTasks(projectId),
        fetchApprovalRequests('pending'),
      ]);
      setAgents(agentList);
      setTasks(taskList);
      setPendingApprovals(approvalList);

      if (taskList.length > 0 && !activeTask) {
        setActiveTask(taskList[0]);
        if (taskList[0].steps) {
          setActiveSteps(taskList[0].steps);
        }
      }
    } catch (err) {
      console.error('Failed to load multi-agent workspace data:', err);
    }
  }, [projectId, activeTask]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Connect SSE Stream for active task
  const connectSSE = useCallback((taskId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const baseUrl = getApiBaseUrl();
    const es = new EventSource(`${baseUrl}/api/v2/orchestrator/tasks/${encodeURIComponent(taskId)}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('step_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveSteps((prev) => {
          const idx = prev.findIndex((s) => s.id === data.step_id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], status: data.status, output_payload: data.output };
            return next;
          }
          return [...prev, data as TaskStepRecord];
        });
        audioService.playSphereInteraction();
      } catch (err) {
        console.error('SSE step_update error:', err);
      }
    });

    es.addEventListener('task_status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActiveTask((prev) => (prev ? { ...prev, status: data.status, final_output: data.final_output } : null));
        if (data.status === 'completed') {
          setIsExecuting(false);
          audioService.playCompletion();
          loadInitialData();
        } else if (data.status === 'paused_approval') {
          setIsExecuting(false);
          audioService.playError();
          fetchApprovalRequests('pending').then(setPendingApprovals);
        }
      } catch (err) {
        console.error('SSE task_status error:', err);
      }
    });

    es.onerror = () => {
      es.close();
      setIsExecuting(false);
    };
  }, [loadInitialData]);

  // Launch new multi-agent task
  const handleLaunchTask = async (customGoal?: string) => {
    const targetGoal = customGoal || goal;
    if (!targetGoal.trim() || isExecuting) return;

    setIsExecuting(true);
    audioService.playSearchStart();

    try {
      const res = await createMultiAgentTask(targetGoal, projectId);
      setGoal('');
      // Fetch full task
      const fullTask = await fetchMultiAgentTask(res.task_id);
      setActiveTask(fullTask);
      setActiveSteps(fullTask.steps || []);
      setActiveTab('dag');

      // Connect SSE
      connectSSE(res.task_id);
      loadInitialData();
    } catch (err) {
      console.error('Failed to launch task:', err);
      setIsExecuting(false);
      audioService.playError();
    }
  };

  // Handle Human Approval
  const handleResolveApproval = async (requestId: string, decision: 'approved' | 'rejected') => {
    try {
      await resolveApprovalRequest(requestId, decision, reviewNote || 'Approved via Governance Console');
      setReviewNote('');
      audioService.playCompletion();

      if (activeTask && activeTask.id) {
        await resumeMultiAgentTask(activeTask.id);
        setIsExecuting(true);
        connectSSE(activeTask.id);
      }
      loadInitialData();
    } catch (err) {
      console.error('Failed to resolve approval:', err);
      audioService.playError();
    }
  };

  // Helper for agent icons
  const getAgentIcon = (agentId: string) => {
    if (agentId.includes('code')) return <FileCode className="w-4 h-4 text-emerald-400" />;
    if (agentId.includes('security')) return <Shield className="w-4 h-4 text-rose-400" />;
    if (agentId.includes('research')) return <Globe className="w-4 h-4 text-sky-400" />;
    if (agentId.includes('document')) return <FileText className="w-4 h-4 text-amber-400" />;
    if (agentId.includes('knowledge')) return <Database className="w-4 h-4 text-purple-400" />;
    return <Bot className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 overflow-y-auto">
      {/* Top Banner: Hybrid Multi-Agent Governance Platform */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/60 px-6 py-4 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Shield className="w-3 h-3" /> PS 2: GOVERNED MULTI-AGENT CORE
              </span>
              <span className="text-xs text-zinc-500">Autonomous Orchestration • Central Policy Guardrails</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-1">Multi-Agent AI Governance Workspace</h1>
          </div>

          <div className="flex items-center gap-2">
            {pendingApprovals.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                {pendingApprovals.length} Approval Pending
              </span>
            )}
            <button
              onClick={() => loadInitialData()}
              className="p-1.5 text-zinc-400 hover:text-white rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-900 transition-colors"
              title="Refresh Tasks"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Goal Input & Quick Launch */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="relative flex items-center">
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLaunchTask()}
              placeholder="State a complex objective (e.g., 'Analyze my codebase, identify security weaknesses, research remediation methods and prepare a report.')..."
              className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 pr-28 transition-all"
            />
            <button
              onClick={() => handleLaunchTask()}
              disabled={isExecuting || !goal.trim()}
              className="absolute right-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {isExecuting ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Execute</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 text-xs">
            <span className="text-zinc-500 flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 text-amber-400" /> Quick Workflows:
            </span>
            {PRESET_GOALS.map((preset, i) => (
              <button
                key={i}
                onClick={() => {
                  setGoal(preset);
                  handleLaunchTask(preset);
                }}
                className="shrink-0 px-2.5 py-1 rounded-md bg-zinc-900/70 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700 text-zinc-300 transition-colors"
              >
                {preset.slice(0, 48)}...
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Agent Dashboard Ribbon */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Registered Specialized Agents ({agents.length})
            </h2>
            <span className="text-[11px] text-zinc-500">Autonomous capabilities bounded by Central Policy</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {agents.map((agent) => {
              const isBusy = agent.status === 'executing';
              const isWaiting = agent.status === 'waiting_approval';
              return (
                <div
                  key={agent.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isBusy
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm shadow-emerald-950/50'
                      : isWaiting
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-zinc-800/60">{getAgentIcon(agent.id)}</div>
                    <span
                      className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                        isBusy
                          ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                          : isWaiting
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-white mt-2 truncate">{agent.name}</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{agent.description}</p>
                  <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{agent.capabilities.length} Tools</span>
                    <span className="truncate max-w-[90px]">{agent.role}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Human Approval Center (If pending) */}
        {pendingApprovals.length > 0 && (
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-4 shadow-lg shadow-black">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-300">Human-in-the-Loop Approval Required</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                Risk Score: {pendingApprovals[0].risk_score}/100
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed mb-3">
              {pendingApprovals[0].risk_explanation}
            </p>

            <div className="bg-zinc-900/90 rounded-lg p-3 text-xs font-mono border border-zinc-800 text-zinc-300 mb-3 overflow-x-auto">
              <div className="text-zinc-500 text-[10px] mb-1">PROPOSED ACTION PARAMETERS:</div>
              <div>Action: <span className="text-amber-400">{pendingApprovals[0].action_requested}</span></div>
              <div>Agent: <span className="text-zinc-400">{pendingApprovals[0].agent_id}</span></div>
              <div>Payload: <span className="text-emerald-400">{JSON.stringify(pendingApprovals[0].parameters)}</span></div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                placeholder="Optional reviewer notes / reason..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full sm:flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleResolveApproval(pendingApprovals[0].id, 'rejected')}
                  className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 font-medium text-xs rounded-lg transition-colors"
                >
                  Reject Action
                </button>
                <button
                  onClick={() => handleResolveApproval(pendingApprovals[0].id, 'approved')}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5" /> Approve & Resume
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Task Workspace (DAG & Execution Tabs) */}
        {activeTask && (
          <div className="bg-zinc-900/40 border border-zinc-800/90 rounded-2xl overflow-hidden shadow-xl">
            {/* Header / Tabs */}
            <div className="border-b border-zinc-800/80 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/40">
              <div className="flex items-center gap-2 truncate">
                <span className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                  <Layers className="w-4 h-4 text-emerald-400" />
                </span>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{activeTask.goal}</h3>
                    {tasks.length > 1 && (
                      <select
                        value={activeTask.id}
                        onChange={async (e) => {
                          const selected = await fetchMultiAgentTask(e.target.value);
                          setActiveTask(selected);
                          setActiveSteps(selected.steps || []);
                        }}
                        className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 rounded px-2 py-0.5 focus:outline-none"
                      >
                        {tasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.goal.slice(0, 36)}... ({t.status})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span>Task ID: {activeTask.id}</span>
                    <span>•</span>
                    <span className="capitalize font-medium text-zinc-400">Status: {activeTask.status}</span>
                  </div>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800 shrink-0">
                <button
                  onClick={() => setActiveTab('report')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'report' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Synthesized Report
                </button>
                <button
                  onClick={() => setActiveTab('dag')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'dag' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Execution DAG ({activeSteps.length})
                </button>
                <button
                  onClick={async () => {
                    setActiveTab('audit');
                    const logs = await fetchAuditLogs(activeTask.id);
                    setAuditLogs(logs);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'audit' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Audit Stream
                </button>
              </div>
            </div>

            {/* Tab 1: Synthesized Executive Report */}
            {activeTab === 'report' && (
              <div className="p-6">
                {activeTask.final_output ? (
                  <div className="prose prose-invert max-w-none text-zinc-200 text-sm">
                    <MarkdownRenderer content={activeTask.final_output} />
                  </div>
                ) : (
                  <div className="py-16 text-center text-zinc-500">
                    <RotateCw className="w-8 h-8 animate-spin mx-auto text-emerald-500/60 mb-3" />
                    <p className="text-sm">Agents are currently executing planned subtasks...</p>
                    <p className="text-xs text-zinc-600 mt-1">Switch to the "Execution DAG" tab to watch real-time progress.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Execution DAG */}
            {activeTab === 'dag' && (
              <div className="p-6 flex flex-col gap-4">
                <div className="text-xs text-zinc-400 flex items-center justify-between">
                  <span>Planned Subtask Execution Graph (Governed by Central Policy)</span>
                  <span>Sequential & Parallel State Machine</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {activeSteps.map((step) => {
                    const isRunning = step.status === 'running';
                    const isDone = step.status === 'completed';
                    const isWaiting = step.status === 'waiting_approval';
                    return (
                      <div
                        key={step.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isRunning
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : isWaiting
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : isDone
                            ? 'bg-zinc-900/40 border-zinc-800/60'
                            : 'bg-zinc-900/20 border-zinc-800/40 text-zinc-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-zinc-800 text-zinc-300">
                              {step.step_index}
                            </span>
                            <div>
                              <h4 className="text-xs font-semibold text-white">{step.title}</h4>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                <span>Agent: <code className="text-zinc-300">{step.assigned_agent_id}</code></span>
                                <span>•</span>
                                <span>Governance: <span className="text-emerald-400 uppercase font-semibold">{step.governance_status}</span></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isRunning && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <RotateCw className="w-3 h-3 animate-spin" /> Running
                              </span>
                            )}
                            {isDone && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Completed
                              </span>
                            )}
                            {isWaiting && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> Waiting Approval
                              </span>
                            )}
                          </div>
                        </div>

                        {step.output_payload && (
                          <div className="mt-3 pt-3 border-t border-zinc-800/60 text-xs text-zinc-300 bg-zinc-950/40 p-3 rounded-lg">
                            <div className="font-semibold text-zinc-400 text-[10px] uppercase mb-1">Agent Step Output:</div>
                            <div className="line-clamp-3 font-mono text-[11px] text-zinc-300">
                              {step.output_payload.summary || JSON.stringify(step.output_payload)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: Tamper-Evident Audit Stream */}
            {activeTab === 'audit' && (
              <div className="p-6">
                <div className="text-xs text-zinc-400 mb-3">
                  All inter-agent messages, tool invocations, and governance decisions logged in SQLite.
                </div>
                {auditLogs.length > 0 ? (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 font-mono text-xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-400">{log.sender_id} ➔ {log.recipient_id}</span>
                          <span className="text-zinc-500">{new Date(log.timestamp * 1000).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-zinc-300">
                          Type: <span className="text-amber-400 font-semibold">{log.message_type}</span> | Policy: <span className="text-emerald-300">{log.governance_decision}</span>
                        </div>
                        <div className="text-zinc-400 text-[11px] truncate">
                          {JSON.stringify(log.content)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-500 text-xs">
                    No message logs recorded yet for this task.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
