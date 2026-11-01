import React, { useState, useEffect } from 'react';
import {
  Globe,
  Database,
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  Clock,
  Layers,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ChevronRight,
  X,
  Activity,
  AlertCircle,
} from 'lucide-react';
import {
  CrawlerOverviewStats,
  CrawlerDomainItem,
  CrawlerJobItem,
  CrawledDocumentItem,
  CrawlerMonitoringMetrics
} from '../types/api';

const API_BASE = '/api/v2';

export const WebIntelligenceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'jobs' | 'index' | 'monitoring'>('overview');
  
  // Data State
  const [stats, setStats] = useState<CrawlerOverviewStats | null>(null);
  const [domains, setDomains] = useState<CrawlerDomainItem[]>([]);
  const [jobs, setJobs] = useState<CrawlerJobItem[]>([]);
  const [documents, setDocuments] = useState<CrawledDocumentItem[]>([]);
  const [monitoring, setMonitoring] = useState<CrawlerMonitoringMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modals & Inspectors
  const [isAddDomainModalOpen, setIsAddDomainModalOpen] = useState(false);
  const [isLaunchJobModalOpen, setIsLaunchJobModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<CrawledDocumentItem | null>(null);

  // Forms State
  const [newDomain, setNewDomain] = useState('');
  const [newAllowedPaths, setNewAllowedPaths] = useState('/');
  const [newCrawlDelay, setNewCrawlDelay] = useState(1.0);
  const [newMaxDepth, setNewMaxDepth] = useState(2);
  const [newMaxPages, setNewMaxPages] = useState(50);
  const [domainModalError, setDomainModalError] = useState<string | null>(null);
  const [isSavingDomain, setIsSavingDomain] = useState(false);

  // Job Launch Form
  const [jobTitle, setJobTitle] = useState('');
  const [jobDomains, setJobDomains] = useState<string[]>([]);
  const [jobMaxPages, setJobMaxPages] = useState(30);
  const [jobMaxDepth, setJobMaxDepth] = useState(2);

  // Search in Index
  const [indexSearchQuery, setIndexSearchQuery] = useState('');

  const fetchOverviewData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, domRes, jobsRes, monRes] = await Promise.all([
        fetch(`${API_BASE}/crawler/stats`).then((r) => r.json()),
        fetch(`${API_BASE}/crawler/domains`).then((r) => r.json()),
        fetch(`${API_BASE}/crawler/jobs?limit=20`).then((r) => r.json()),
        fetch(`${API_BASE}/crawler/monitoring`).then((r) => r.json()),
      ]);

      setStats(statsRes);
      setDomains(domRes.domains || []);
      setJobs(jobsRes.jobs || []);
      setMonitoring(monRes);
    } catch (err) {
      console.error('Failed to load crawler data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocuments = async (query: string = '') => {
    try {
      const url = query.trim()
        ? `${API_BASE}/crawler/documents?q=${encodeURIComponent(query.trim())}`
        : `${API_BASE}/crawler/documents?limit=40`;
      const res = await fetch(url).then((r) => r.json());
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  useEffect(() => {
    if (activeTab === 'index') {
      fetchDocuments(indexSearchQuery);
    }
  }, [activeTab]);

  // Polling for active jobs
  useEffect(() => {
    let interval: any = null;
    if (stats?.crawler_status === 'active' || activeTab === 'jobs') {
      interval = setInterval(() => {
        fetchOverviewData();
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [stats?.crawler_status, activeTab]);

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Actions
  const handleAddDomainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDomainModalError(null);

    const cleanDomain = newDomain.trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim();
    if (!cleanDomain) {
      setDomainModalError('Please enter a valid domain name (e.g. docs.python.org)');
      return;
    }

    setIsSavingDomain(true);
    try {
      console.log(`[WebIntelligence] Submitting domain registration for: ${cleanDomain}`);
      const paths = newAllowedPaths.split(',').map((p) => p.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/crawler/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: cleanDomain,
          allowed_paths: paths.length ? paths : ['/'],
          crawl_delay_sec: Number(newCrawlDelay),
          max_depth: Number(newMaxDepth),
          max_pages: Number(newMaxPages),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save domain configuration');
      }

      console.log('[WebIntelligence] Domain registration success:', data);
      showNotification(data.domain?.message || `Domain '${cleanDomain}' saved to crawl allowlist.`);
      setIsAddDomainModalOpen(false);
      setNewDomain('');
      setDomainModalError(null);
      await fetchOverviewData();
    } catch (err: any) {
      console.error('[WebIntelligence] Error registering domain:', err);
      setDomainModalError(err.message || 'Failed to save domain');
      showNotification(`Error: ${err.message || 'Failed to save domain'}`);
    } finally {
      setIsSavingDomain(false);
    }
  };

  const handleToggleDomain = async (id: string) => {
    try {
      await fetch(`${API_BASE}/crawler/domains/${id}/toggle`, { method: 'POST' });
      fetchOverviewData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    try {
      await fetch(`${API_BASE}/crawler/domains/${id}`, { method: 'DELETE' });
      showNotification('Domain removed from allowlist.');
      fetchOverviewData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLaunchJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || jobDomains.length === 0) {
      showNotification('Please specify a title and select at least one domain.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/crawler/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jobTitle.trim(),
          target_domains: jobDomains,
          max_pages: Number(jobMaxPages),
          max_depth: Number(jobMaxDepth),
        }),
      });

      if (!res.ok) throw new Error('Failed to start crawl job');

      showNotification(`Crawl job '${jobTitle}' dispatched.`);
      setIsLaunchJobModalOpen(false);
      setJobTitle('');
      setJobDomains([]);
      setActiveTab('jobs');
      fetchOverviewData();
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  const handlePauseJob = async (jobId: string) => {
    await fetch(`${API_BASE}/crawler/jobs/${jobId}/pause`, { method: 'POST' });
    showNotification(`Job ${jobId} paused.`);
    fetchOverviewData();
  };

  const handleResumeJob = async (jobId: string) => {
    await fetch(`${API_BASE}/crawler/jobs/${jobId}/resume`, { method: 'POST' });
    showNotification(`Job ${jobId} resumed.`);
    fetchOverviewData();
  };

  const handleCancelJob = async (jobId: string) => {
    await fetch(`${API_BASE}/crawler/jobs/${jobId}/cancel`, { method: 'POST' });
    showNotification(`Job ${jobId} cancelled.`);
    fetchOverviewData();
  };

  const handleRetryJob = async (jobId: string) => {
    await fetch(`${API_BASE}/crawler/jobs/${jobId}/retry`, { method: 'POST' });
    showNotification(`Retrying failed URLs for job ${jobId}...`);
    fetchOverviewData();
  };

  const handleDeleteDocument = async (docId: string) => {
    await fetch(`${API_BASE}/crawler/documents/${docId}`, { method: 'DELETE' });
    showNotification('Document removed from search index.');
    if (selectedDoc?.id === docId) setSelectedDoc(null);
    fetchDocuments(indexSearchQuery);
    fetchOverviewData();
  };

  const handleSearchIndexSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments(indexSearchQuery);
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col bg-[#03060E] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 bg-[#070B14]/95 backdrop-blur-md border-b border-[#1A2338] px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-inner">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              Web Intelligence & Search Index
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-[10px] font-mono uppercase">
                Crawling Infrastructure
              </span>
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Autonomous domain discovery, content extraction, and BM25 full-text indexing
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchOverviewData()}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              // Pre-select first 2 enabled domains
              const enabled = domains.filter((d) => d.enabled).map((d) => d.domain);
              setJobDomains(enabled.slice(0, 2));
              setJobTitle(`Technical Documentation Crawl #${(jobs.length || 0) + 1}`);
              setIsLaunchJobModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs font-mono flex items-center gap-1.5 shadow-lg transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Launch Crawl Job</span>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-[#0B111E]/95 border border-cyan-500/40 text-cyan-300 text-xs font-mono px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="bg-[#060912] border-b border-[#1A2338] px-3 sm:px-6 flex items-center gap-4 sm:gap-6 text-xs font-mono select-none overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: <Layers className="w-3.5 h-3.5 text-cyan-400" /> },
          { id: 'domains', label: `Domain Allowlist (${domains.length})`, icon: <Globe className="w-3.5 h-3.5 text-blue-400" /> },
          { id: 'jobs', label: `Crawl Jobs (${jobs.length})`, icon: <Play className="w-3.5 h-3.5 text-emerald-400" /> },
          { id: 'index', label: `Search Index (${stats?.indexed_documents || 0})`, icon: <Database className="w-3.5 h-3.5 text-pink-400" /> },
          { id: 'monitoring', label: 'Observability & Metrics', icon: <BarChart3 className="w-3.5 h-3.5 text-amber-400" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 min-h-[44px] flex items-center gap-1.5 border-b-2 font-medium transition-colors shrink-0 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-cyan-400 text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 pb-20 pb-safe">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { label: 'Discovered URLs', value: stats?.total_discovered || 0, color: 'text-cyan-400', desc: 'Queued & Traversed' },
                { label: 'Crawled Pages', value: stats?.crawled_pages || 0, color: 'text-emerald-400', desc: 'Safe HTTP 200' },
                { label: 'Indexed Documents', value: stats?.indexed_documents || 0, color: 'text-sky-300', desc: 'BM25 Searchable' },
                { label: 'Failed URLs', value: stats?.failed_urls || 0, color: 'text-rose-400', desc: '404 / Timeouts' },
                { label: 'Pending in Queue', value: stats?.pending_urls || 0, color: 'text-amber-400', desc: 'Priority Backlog' },
                { label: 'Active Jobs', value: stats?.active_jobs || 0, color: 'text-purple-400', desc: 'Concurrent Workers' },
              ].map((m, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{m.label}</span>
                  <div className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] font-mono text-slate-400">{m.desc}</div>
                </div>
              ))}
            </div>

            {/* Architecture & Status Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Crawler Security & SSRF Protection Status</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    Hardened &amp; Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#05070E] border border-white/5 space-y-1">
                    <span className="text-slate-400 block font-bold text-[11px]">Private IP &amp; Cloud Metadata Filter</span>
                    <p className="text-slate-400 leading-relaxed text-[11px] font-sans">
                      Blocks 127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, and cloud metadata (169.254.169.254).
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#05070E] border border-white/5 space-y-1">
                    <span className="text-slate-400 block font-bold text-[11px]">DNS Resolution &amp; Rebind Guard</span>
                    <p className="text-slate-400 leading-relaxed text-[11px] font-sans">
                      Validates all resolved IP targets and re-verifies destinations on every redirect hop.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#05070E] border border-white/5 space-y-1">
                    <span className="text-slate-400 block font-bold text-[11px]">robots.txt Politeness Engine</span>
                    <p className="text-slate-400 leading-relaxed text-[11px] font-sans">
                      Respects Crawl-delay, Disallow directives, and sitemaps with per-domain token bucket.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#05070E] border border-white/5 space-y-1">
                    <span className="text-slate-400 block font-bold text-[11px]">FTS5 BM25 Search Engine</span>
                    <p className="text-slate-400 leading-relaxed text-[11px] font-sans">
                      SQLite virtual table with field weighting (Title 5x, Headings 3x) and stemming.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Crawler Heartbeat */}
              <div className="p-6 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white">Crawler Heartbeat</h3>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${stats?.crawler_status === 'active' ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                </div>

                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Status</span>
                    <span className={`font-bold uppercase ${stats?.crawler_status === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {stats?.crawler_status || 'IDLE'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Requests / Minute</span>
                    <span className="text-cyan-300 font-bold">{stats?.requests_per_minute || 0} req/min</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Active Seed Domains</span>
                    <span className="text-white">{stats?.active_domains || 0} domains</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">User-Agent</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[140px]">AnveshaBot/1.0</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setDomainModalError(null);
                    setIsAddDomainModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-mono flex items-center justify-center gap-2 border border-white/5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Seed Domain</span>
                </button>
              </div>
            </div>

            {/* Recent Crawl Jobs Preview */}
            <div className="p-6 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Recent Crawl Jobs</h3>
                </div>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>View All Jobs</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {jobs.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {jobs.slice(0, 5).map((j) => (
                    <div key={j.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{j.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            j.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : j.status === 'running'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                              : 'bg-slate-500/10 text-slate-400 border border-white/5'
                          }`}>
                            {j.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 pt-0.5">
                          Domains: {j.target_domains.join(', ')} &bull; Progress: {j.total_crawled} / {j.total_discovered} pages
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {j.status === 'running' && (
                          <button
                            onClick={() => handlePauseJob(j.id)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300"
                            title="Pause Job"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {j.status === 'paused' && (
                          <button
                            onClick={() => handleResumeJob(j.id)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                            title="Resume Job"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                        <span className="text-slate-400 font-bold">{j.progress_percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-slate-500">
                  No crawl jobs executed yet. Click "Launch Crawl Job" to start.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DOMAIN MANAGEMENT */}
        {activeTab === 'domains' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Configured Seed Domains</h3>
                <p className="text-xs font-mono text-slate-400">
                  Approved crawl targets with per-domain path restrictions, crawl delays, and robots.txt policies.
                </p>
              </div>
              <button
                onClick={() => {
                  setDomainModalError(null);
                  setIsAddDomainModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs font-mono flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Domain</span>
              </button>
            </div>

            <div className="divide-y divide-white/5 rounded-2xl bg-[#080C16] border border-[#1C2538] overflow-hidden">
              {domains.map((dom) => (
                <div key={dom.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-white text-sm">{dom.domain}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        dom.enabled ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {dom.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                      <span>Delay: <strong className="text-slate-300">{dom.crawl_delay_sec}s</strong></span>
                      <span>&bull;</span>
                      <span>Max Depth: <strong className="text-slate-300">{dom.max_depth}</strong></span>
                      <span>&bull;</span>
                      <span>Total Crawled: <strong className="text-emerald-400">{dom.total_crawled}</strong></span>
                      <span>&bull;</span>
                      <span>Robots.txt: <strong className="text-sky-300 uppercase">{dom.robots_txt_status}</strong></span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-sans">
                      Allowed Prefixes: {dom.allowed_paths.join(', ') || '/'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleDomain(dom.id)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-colors"
                    >
                      {dom.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeleteDomain(dom.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors"
                      title="Delete Domain"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: CRAWL JOBS */}
        {activeTab === 'jobs' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Crawl Jobs &amp; Execution Queue</h3>
                <p className="text-xs font-mono text-slate-400">
                  Manage running background crawlers, view progression, and inspect crawl failures.
                </p>
              </div>
              <button
                onClick={() => {
                  setJobDomains(domains.filter((d) => d.enabled).map((d) => d.domain).slice(0, 2));
                  setIsLaunchJobModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs font-mono flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>New Job</span>
              </button>
            </div>

            <div className="space-y-3">
              {jobs.map((j) => (
                <div key={j.id} className="p-5 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{j.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          j.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : j.status === 'running'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                            : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {j.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Target: {j.target_domains.join(', ')} &bull; ID: {j.id}
                      </div>
                    </div>

                    {/* Job Controls */}
                    <div className="flex items-center gap-2">
                      {j.status === 'running' && (
                        <button
                          onClick={() => handlePauseJob(j.id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 flex items-center gap-1"
                        >
                          <Pause className="w-3 h-3" />
                          <span>Pause</span>
                        </button>
                      )}
                      {j.status === 'paused' && (
                        <button
                          onClick={() => handleResumeJob(j.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Resume</span>
                        </button>
                      )}
                      {(j.status === 'running' || j.status === 'paused') && (
                        <button
                          onClick={() => handleCancelJob(j.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 flex items-center gap-1"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          <span>Cancel</span>
                        </button>
                      )}
                      {j.total_failed > 0 && (
                        <button
                          onClick={() => handleRetryJob(j.id)}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry Failed ({j.total_failed})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                      <span>Crawled: {j.total_crawled} / {j.total_discovered} pages ({j.total_indexed} indexed)</span>
                      <span className="font-bold text-cyan-300">{j.progress_percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${j.progress_percent}%` }}
                      />
                    </div>
                  </div>

                  {j.current_url && j.status === 'running' && (
                    <div className="text-[11px] font-mono text-cyan-400 truncate flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                      <span className="truncate">Currently fetching: {j.current_url}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SEARCH INDEX EXPLORER */}
        {activeTab === 'index' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Full-Text Document Index (BM25)</h3>
                <p className="text-xs font-mono text-slate-400">
                  Inspect indexed pages, view BM25 relevance scores, extracted headings, and metadata.
                </p>
              </div>

              {/* Search input in index */}
              <form onSubmit={handleSearchIndexSubmit} className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={indexSearchQuery}
                    onChange={(e) => setIndexSearchQuery(e.target.value)}
                    placeholder="Search inside crawled index..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#090E1A] border border-[#232F4A] text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs font-mono"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Document Table / List */}
            {documents.length > 0 ? (
              <div className="divide-y divide-white/5 rounded-2xl bg-[#080C16] border border-[#1C2538] overflow-hidden">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 hover:bg-white/[0.02] transition-colors space-y-1.5 text-xs text-left"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 text-[11px] font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-cyan-300">{doc.domain}</span>
                        <span>&bull;</span>
                        <span>Words: {doc.word_count}</span>
                        {doc.score !== undefined && (
                          <>
                            <span>&bull;</span>
                            <span className="text-emerald-400">BM25 Score: {doc.score.toFixed(3)}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-mono"
                        >
                          Inspect Content
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400"
                          title="Delete from index"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-sky-400 hover:text-sky-300 hover:underline block truncate"
                    >
                      {doc.title || doc.url}
                    </a>

                    <p className="text-slate-400 text-xs font-sans line-clamp-2 leading-relaxed">
                      {doc.snippet || doc.description || doc.content?.slice(0, 200)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 rounded-2xl bg-[#080C16] border border-[#1C2538] text-center text-xs font-mono text-slate-400 space-y-2">
                <Database className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No Indexed Documents Found</h4>
                <p className="text-slate-400">
                  {indexSearchQuery ? 'No documents matched your query.' : 'Run a crawl job to populate the search index.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: OBSERVABILITY & MONITORING */}
        {activeTab === 'monitoring' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold text-white">Crawler Observability &amp; Telemetry</h3>
              <p className="text-xs font-mono text-slate-400">
                Live request rates, HTTP response distributions, and domain traversal metrics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1: HTTP Status Codes */}
              <div className="p-5 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-3">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider">HTTP Status Distribution</h4>
                <div className="divide-y divide-white/5 text-xs font-mono">
                  {monitoring?.status_distribution && Object.keys(monitoring.status_distribution).length > 0 ? (
                    Object.entries(monitoring.status_distribution).map(([status, count]) => (
                      <div key={status} className="py-2 flex items-center justify-between">
                        <span className={`font-bold ${
                          status === '200' ? 'text-emerald-400' : status === '304' ? 'text-cyan-400' : 'text-rose-400'
                        }`}>
                          HTTP {status}
                        </span>
                        <span className="text-white font-bold">{count} responses</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-slate-500">No requests recorded yet</div>
                  )}
                </div>
              </div>

              {/* Card 2: Top Crawled Domains */}
              <div className="p-5 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-3">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider">Top Indexed Domains</h4>
                <div className="divide-y divide-white/5 text-xs font-mono">
                  {monitoring?.top_crawled_domains && monitoring.top_crawled_domains.length > 0 ? (
                    monitoring.top_crawled_domains.map((td) => (
                      <div key={td.domain} className="py-2 flex items-center justify-between">
                        <span className="text-slate-300 truncate max-w-[180px]">{td.domain}</span>
                        <span className="text-cyan-300 font-bold">{td.count} pages</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-slate-500">No indexed pages yet</div>
                  )}
                </div>
              </div>

              {/* Card 3: Quality Metrics */}
              <div className="p-5 rounded-2xl bg-[#080C16] border border-[#1C2538] space-y-3">
                <h4 className="text-xs font-bold font-mono text-white uppercase tracking-wider">Content Quality Signals</h4>
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#05070E] border border-white/5 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Average Word Count</span>
                    <span className="text-xl font-bold text-emerald-400">{monitoring?.average_word_count || 0} words</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#05070E] border border-white/5 space-y-1">
                    <span className="text-slate-400 block text-[11px]">Average Text Length</span>
                    <span className="text-xl font-bold text-sky-400">{monitoring?.average_content_length || 0} chars</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD SEED DOMAIN */}
      {isAddDomainModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-md w-full bg-[#080C16] border border-[#232F4A] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                Add Approved Seed Domain
              </h3>
              <button
                onClick={() => {
                  setIsAddDomainModalOpen(false);
                  setDomainModalError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Feedback Display inside Modal */}
            {domainModalError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5 animate-fade-in font-mono">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-sans leading-relaxed">{domainModalError}</div>
              </div>
            )}

            <form onSubmit={handleAddDomainSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Domain Name</label>
                <input
                  type="text"
                  required
                  value={newDomain}
                  onChange={(e) => {
                    setNewDomain(e.target.value);
                    if (domainModalError) setDomainModalError(null);
                  }}
                  placeholder="e.g. docs.python.org"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C1220] border border-[#232F4A] text-white focus:border-cyan-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Allowed Path Prefixes (comma-separated)</label>
                <input
                  type="text"
                  value={newAllowedPaths}
                  onChange={(e) => setNewAllowedPaths(e.target.value)}
                  placeholder="e.g. /tutorial/, /reference/"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C1220] border border-[#232F4A] text-white focus:border-cyan-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Delay (s)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={newCrawlDelay}
                    onChange={(e) => setNewCrawlDelay(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0C1220] border border-[#232F4A] text-white text-center"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Depth</label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={newMaxDepth}
                    onChange={(e) => setNewMaxDepth(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0C1220] border border-[#232F4A] text-white text-center"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Pages</label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={newMaxPages}
                    onChange={(e) => setNewMaxPages(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0C1220] border border-[#232F4A] text-white text-center"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 text-[11px] font-sans">
                Domain will be verified for SSRF and private IP protection before registration.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddDomainModalOpen(false);
                    setDomainModalError(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDomain}
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  {isSavingDomain ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Domain...</span>
                    </>
                  ) : (
                    <span>Save Domain</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LAUNCH CRAWL JOB */}
      {isLaunchJobModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#080C16] border border-[#232F4A] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400 fill-current" />
                Dispatch Crawl Job
              </h3>
              <button onClick={() => setIsLaunchJobModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLaunchJobSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Python 3.12 Docs Crawl"
                  className="w-full px-3 py-2 rounded-xl bg-[#0C1220] border border-[#232F4A] text-white focus:border-cyan-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Select Target Domains</label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-[#05070E] border border-white/5">
                  {domains.filter((d) => d.enabled).map((d) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={jobDomains.includes(d.domain)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setJobDomains([...jobDomains, d.domain]);
                          } else {
                            setJobDomains(jobDomains.filter((dom) => dom !== d.domain));
                          }
                        }}
                        className="rounded accent-cyan-400"
                      />
                      <span>{d.domain}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Max Pages Cap</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={jobMaxPages}
                    onChange={(e) => setJobMaxPages(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0C1220] border border-[#232F4A] text-white text-center"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Depth</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={jobMaxDepth}
                    onChange={(e) => setJobMaxDepth(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-lg bg-[#0C1220] border border-[#232F4A] text-white text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLaunchJobModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
                >
                  Start Crawl
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DOCUMENT CONTENT INSPECTOR */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full max-h-[80vh] flex flex-col bg-[#080C16] border border-[#232F4A] rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="truncate pr-4">
                <h3 className="text-sm font-bold text-white truncate">{selectedDoc.title}</h3>
                <span className="text-xs font-mono text-cyan-400">{selectedDoc.url}</span>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-white shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono text-slate-300">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Domain</span>
                  <span className="text-white truncate">{selectedDoc.domain}</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Words</span>
                  <span className="text-white">{selectedDoc.word_count}</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Language</span>
                  <span className="text-white uppercase">{selectedDoc.language}</span>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Canonical URL</span>
                  <span className="text-white truncate">{selectedDoc.canonical_url ? 'Yes' : 'Self'}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Extracted Main Text Content
                </span>
                <div className="p-3 rounded-xl bg-[#04060C] border border-white/5 font-sans leading-relaxed text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto select-text">
                  {selectedDoc.content || 'Content preview unavailable.'}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
              <a
                href={selectedDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Open Original Live Page</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => setSelectedDoc(null)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
