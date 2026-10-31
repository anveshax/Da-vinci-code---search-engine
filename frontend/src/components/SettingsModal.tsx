import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Palette,
  Cpu,
  Globe,
  ShieldCheck,
  Volume2,
  Keyboard,
  BarChart2,
  Info,
  Check,
  Plus,
  Trash2,
  Activity,
  FileText,
  Upload,
  Sparkles,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import {
  fetchPlatformSettings,
  savePlatformSetting,
  fetchAIProviders,
  saveAIProvider,
  testAIProviderConnection,
  removeAIProvider,
  fetchProjectDocuments,
  uploadIntelligenceDocument,
  deleteProjectDocument,
} from '../services/api';
import { ConnectionState, AIProviderStatus, DocumentRecord } from '../types/api';
import { audioService } from '../services/audioService';
import {
  globeSettingsService,
  GlobeSettings,
  GlobeColorPreset,
} from '../services/globeSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: ConnectionState;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  connection,
}) => {
  const [activeSection, setActiveSection] = useState<string>('ai_providers');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [defaultMode, setDefaultMode] = useState<string>('auto');
  const [tonePreference, setTonePreference] = useState<string>('balanced');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [audioSettings, setAudioSettings] = useState(audioService.getSettings());
  const [globeSettings, setGlobeSettings] = useState<GlobeSettings>(globeSettingsService.getSettings());

  useEffect(() => {
    const unsub = globeSettingsService.subscribe((s) => {
      setGlobeSettings(s);
    });
    return unsub;
  }, []);

  // AI Providers state
  const [providers, setProviders] = useState<AIProviderStatus[]>([]);
  const [activeInfo, setActiveInfo] = useState<any>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('groq');
  const [inputApiKey, setInputApiKey] = useState<string>('');
  const [inputModel, setInputModel] = useState<string>('llama-3.3-70b-versatile');
  const [inputBaseUrl, setInputBaseUrl] = useState<string>('');
  const [isDefaultProvider, setIsDefaultProvider] = useState<boolean>(true);
  const [isFallbackProvider, setIsFallbackProvider] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ status: string; latency_ms?: number; error?: string } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [isSavingProvider, setIsSavingProvider] = useState<boolean>(false);

  // Documents state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  const loadAIProviders = async () => {
    try {
      const data = await fetchAIProviders();
      setProviders(data.providers || []);
      setActiveInfo(data.active_info || null);
    } catch (err) {
      console.warn('Could not load AI providers:', err);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await fetchProjectDocuments('default');
      setDocuments(docs);
    } catch (err) {
      console.warn('Could not load documents:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPlatformSettings().then((s) => {
        if (s.theme) setTheme(s.theme);
        if (s.defaultMode) setDefaultMode(s.defaultMode);
        if (s.tonePreference) setTonePreference(s.tonePreference);
      });
      loadAIProviders();
      loadDocuments();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (key: string, value: any) => {
    await savePlatformSetting(key, value);
    setSavedNotice(`Saved ${key}`);
    setTimeout(() => setSavedNotice(null), 2000);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const result = await testAIProviderConnection({
        provider_id: selectedProviderId,
        api_key: inputApiKey.trim() || undefined,
        model: inputModel.trim() || undefined,
        base_url: inputBaseUrl.trim() || undefined,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ status: 'error', error: err.message || 'Connection failed' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveProvider = async () => {
    if (!inputApiKey.trim()) {
      setTestResult({ status: 'error', error: 'Please enter a valid API key.' });
      return;
    }
    setIsSavingProvider(true);
    try {
      await saveAIProvider({
        provider_id: selectedProviderId,
        api_key: inputApiKey.trim(),
        model: inputModel.trim() || undefined,
        base_url: inputBaseUrl.trim() || undefined,
        is_default: isDefaultProvider,
        is_fallback: isFallbackProvider,
      });
      setInputApiKey('');
      setSavedNotice('Provider saved securely');
      await loadAIProviders();
      setTimeout(() => setSavedNotice(null), 2000);
    } catch (err: any) {
      setTestResult({ status: 'error', error: err.message });
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleRemoveProvider = async (pid: string) => {
    try {
      await removeAIProvider(pid);
      await loadAIProviders();
      setSavedNotice(`Removed ${pid}`);
      setTimeout(() => setSavedNotice(null), 2000);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc(true);
    setDocUploadError(null);
    try {
      await uploadIntelligenceDocument(file, 'default');
      await loadDocuments();
      setSavedNotice(`Uploaded ${file.name}`);
      setTimeout(() => setSavedNotice(null), 2000);
    } catch (err: any) {
      setDocUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await deleteProjectDocument(id);
      await loadDocuments();
    } catch (err: any) {
      console.error(err);
    }
  };

  const sections = [
    { id: 'ai_providers', label: 'AI Providers & Models', icon: <Cpu className="w-4 h-4 text-sky-400" /> },
    { id: 'documents', label: 'Document Intelligence', icon: <FileText className="w-4 h-4 text-emerald-400" /> },
    { id: 'search', label: 'Search Engine & Grounding', icon: <Globe className="w-4 h-4 text-amber-400" /> },
    { id: 'globe_appearance', label: 'Globe Appearance & Lighting', icon: <Sparkles className="w-4 h-4 text-cyan-400" /> },
    { id: 'general', label: 'General & Inference Tone', icon: <Settings className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy & Security Sandbox', icon: <ShieldCheck className="w-4 h-4 text-rose-400" /> },
    { id: 'audio', label: 'Spatial Audio & Haptics', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'usage', label: 'System Observability', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'about', label: 'About Platform', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[85vh] bg-[#090C16] border border-[#1E2638] rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Section Navigation (w-60) */}
        <div className="w-full md:w-60 border-r border-[#1B2234] bg-[#07090F] flex flex-col shrink-0">
          <div className="p-4 border-b border-[#1A2030] flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-white tracking-wider uppercase">
              Platform Settings
            </span>
            {savedNotice && (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>{savedNotice}</span>
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                  activeSection === sec.id
                    ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {sec.icon}
                <span className="truncate">{sec.label}</span>
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-[#1A2030] bg-[#06080D]">
            <span className="text-[10px] text-slate-400 font-mono block">
              Core Engine v2.0
            </span>
            <span className="text-[10px] text-emerald-400 font-mono block">
              Multi-Provider Active
            </span>
          </div>
        </div>

        {/* Right Section Content Pane */}
        <div className="flex-1 flex flex-col bg-[#0A0D18] overflow-hidden">
          <div className="p-4 border-b border-[#1A2030] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white capitalize font-mono">
              {sections.find((s) => s.id === activeSection)?.label}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
            {/* 1. AI Providers & Models Dashboard */}
            {activeSection === 'ai_providers' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Configured AI Providers</h3>
                  <p className="text-slate-400 text-xs">
                    Configure API keys securely. Credentials are encrypted on the backend and strictly masked in the browser.
                  </p>
                </div>

                {/* Configured Providers Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl bg-[#0F1424] border border-[#1E2638] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-white text-xs">{p.name}</span>
                          <div className="flex items-center gap-1">
                            {p.is_default && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[9px] font-mono">
                                Primary
                              </span>
                            )}
                            {p.is_fallback && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono">
                                Fallback
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                                p.configured
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {p.configured ? 'Configured' : 'Missing Key'}
                            </span>
                          </div>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Model: <span className="text-slate-200">{p.model}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Key: {p.masked_key}
                        </div>
                      </div>

                      {p.configured && (
                        <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setSelectedProviderId(p.id);
                              setInputModel(p.model);
                              handleTestConnection();
                            }}
                            className="text-[11px] text-sky-400 hover:text-sky-300 font-mono"
                          >
                            Test Ping
                          </button>
                          <button
                            onClick={() => handleRemoveProvider(p.id)}
                            className="text-[11px] text-slate-500 hover:text-rose-400 font-mono"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add / Update Provider Form */}
                <div className="p-4 rounded-2xl bg-[#0B0F1C] border border-[#232B3E] space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-sky-400" />
                    Configure Provider Credentials
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                        Select Provider:
                      </label>
                      <select
                        value={selectedProviderId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setSelectedProviderId(pid);
                          if (pid === 'gemini') setInputModel('gemini-3-flash-preview');
                          else if (pid === 'groq') setInputModel('llama-3.3-70b-versatile');
                          else if (pid === 'openrouter') setInputModel('meta-llama/llama-3.3-70b-instruct');
                          else setInputModel('gpt-4o-mini');
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-[#141B2E] border border-[#2A344C] text-white text-xs outline-none"
                      >
                        <option value="gemini">Google Gemini (Gemini 3 Flash / 3.1 Flash Lite)</option>
                        <option value="groq">Groq (Ultra-Fast Llama 3.3)</option>
                        <option value="openrouter">OpenRouter (Claude, Llama, DeepSeek)</option>
                        <option value="openai_compatible">OpenAI-Compatible (Ollama, vLLM, Custom)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                        Model ID:
                      </label>
                      <input
                        type="text"
                        value={inputModel}
                        onChange={(e) => setInputModel(e.target.value)}
                        placeholder="e.g. gemini-3-flash-preview or gemini-3.1-flash-lite"
                        className="w-full px-3 py-2 rounded-xl bg-[#141B2E] border border-[#2A344C] text-white text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                      API Key:
                    </label>
                    <input
                      type="password"
                      value={inputApiKey}
                      onChange={(e) => setInputApiKey(e.target.value)}
                      placeholder="Enter new API Key (stored securely on backend)..."
                      className="w-full px-3 py-2 rounded-xl bg-[#141B2E] border border-[#2A344C] text-white text-xs outline-none font-mono"
                    />
                  </div>

                  {selectedProviderId === 'openai_compatible' && (
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1 font-mono">
                        Base URL:
                      </label>
                      <input
                        type="text"
                        value={inputBaseUrl}
                        onChange={(e) => setInputBaseUrl(e.target.value)}
                        placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                        className="w-full px-3 py-2 rounded-xl bg-[#141B2E] border border-[#2A344C] text-white text-xs outline-none font-mono"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDefaultProvider}
                        onChange={(e) => setIsDefaultProvider(e.target.checked)}
                        className="rounded accent-sky-500"
                      />
                      <span>Set as Primary Provider</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFallbackProvider}
                        onChange={(e) => setIsFallbackProvider(e.target.checked)}
                        className="rounded accent-sky-500"
                      />
                      <span>Set as Fallback Provider</span>
                    </label>
                  </div>

                  {/* Test Feedback Notice */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                        testResult.status === 'connected'
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <Activity className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          {testResult.status === 'connected' ? 'Connectivity Succeeded' : 'Connection Notice'}
                        </p>
                        {testResult.latency_ms && <p>Latency: {testResult.latency_ms}ms</p>}
                        {testResult.error && <p>{testResult.error}</p>}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-mono text-xs border border-white/10 transition-colors"
                    >
                      {isTestingConnection ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProvider}
                      disabled={isSavingProvider}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-semibold text-xs transition-colors shadow-md"
                    >
                      {isSavingProvider ? 'Saving...' : 'Save Credentials'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Document & File Intelligence */}
            {activeSection === 'documents' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Project Documents & Intelligence</h3>
                  <p className="text-slate-400 text-xs">
                    Upload architecture specifications, documentation, and code files (.pdf, .docx, .md, .txt).
                    Chunks are indexed for page-level and line-level citations.
                  </p>
                </div>

                {/* Upload Trigger */}
                <div className="p-4 border border-dashed border-[#232B3E] rounded-2xl bg-[#0B0F1C] text-center">
                  <Upload className="w-6 h-6 text-sky-400 mx-auto mb-2" />
                  <label className="cursor-pointer">
                    <span className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-semibold inline-block">
                      {isUploadingDoc ? 'Uploading & Parsing...' : 'Upload Document'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.py,.ts,.tsx,.json,.rs,.go"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploadingDoc}
                    />
                  </label>
                  <p className="text-[10px] text-slate-500 mt-2 font-mono">
                    Max size: 15MB. Formats: PDF, DOCX, Markdown, Text, Code
                  </p>
                </div>

                {docUploadError && (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono">
                    {docUploadError}
                  </div>
                )}

                {/* Document List */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-slate-400">
                    Uploaded Documents ({documents.length})
                  </div>
                  {documents.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#0F1424] text-center text-slate-500 text-xs">
                      No documents uploaded for this project yet.
                    </div>
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-xl bg-[#0F1424] border border-[#1E2638] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="font-semibold text-white block">{doc.filename}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {Math.round(doc.file_size / 1024)} KB &bull; {doc.chunk_count} indexed chunks
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 3. Search Providers & Grounding */}
            {activeSection === 'search' && (
              <div className="space-y-4 font-sans">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Search Engine & Grounding Pipeline</h3>
                  <p className="text-slate-400 text-xs">
                    Live internet retrieval pipeline with verified organic links, content extraction, and zero Wikipedia fallback.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#232B3E] space-y-1">
                  <div className="font-bold text-white font-mono">DuckDuckGo HTML Parser</div>
                  <div className="text-slate-400 text-xs">
                    Status: <strong className="text-emerald-400">Active (Zero-Cost Public Engine)</strong>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Extracts verified organic destinations without tracking or third-party cookies.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#232B3E] space-y-1">
                  <div className="font-bold text-white font-mono">Tavily & Brave Search APIs</div>
                  <div className="text-slate-400 text-xs">
                    Status: Configurable via <code className="text-sky-300">TAVILY_API_KEY</code> / <code className="text-sky-300">BRAVE_API_KEY</code>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    High-accuracy research search endpoints with structured content extraction.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#232B3E] space-y-1">
                  <div className="font-bold text-white font-mono">Wikipedia Automatic Fallback</div>
                  <div className="text-rose-400 text-xs font-semibold">
                    Status: Permanently Removed
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Per requirements, Wikipedia is never used as an automatic fallback. Real sources are always cited.
                  </p>
                </div>
              </div>
            )}

            {/* 4. General */}
            {activeSection === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 mb-1">Default Search Workflow:</label>
                  <select
                    value={defaultMode}
                    onChange={(e) => {
                      setDefaultMode(e.target.value);
                      handleSave('defaultMode', e.target.value);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0F1422] border border-[#232B3E] text-white outline-none"
                  >
                    <option value="auto">Auto (Intelligent Routing)</option>
                    <option value="code">Codebase Search</option>
                    <option value="web">Web Research</option>
                    <option value="deep">Deep Multi-Step Research</option>
                    <option value="direct">Direct AI Reasoning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">AI Inference Tone:</label>
                  <select
                    value={tonePreference}
                    onChange={(e) => {
                      setTonePreference(e.target.value);
                      handleSave('tonePreference', e.target.value);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#0F1422] border border-[#232B3E] text-white outline-none"
                  >
                    <option value="balanced">Balanced (Default)</option>
                    <option value="concise">Concise & Direct</option>
                    <option value="detailed">Exhaustive & Detailed</option>
                    <option value="technical">Highly Technical / Kernel</option>
                    <option value="beginner">Beginner-Friendly Explanation</option>
                  </select>
                </div>
              </div>
            )}

            {/* 4.5. Globe Appearance & Lighting */}
            {activeSection === 'globe_appearance' && (
              <div className="space-y-6 font-sans">
                {/* Header Card with Reset to Default */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#0F1422] border border-[#232B3E]">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span className="font-semibold text-white text-sm">3D Realistic Earth Lighting</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Adjust real-time Three.js illumination, atmospheric glow, and orbital nodes.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      globeSettingsService.resetToDefault();
                      setSavedNotice('Globe reset to default');
                      setTimeout(() => setSavedNotice(null), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                </div>

                {/* Colour Presets */}
                <div className="p-4 rounded-xl bg-[#0F1422] border border-[#232B3E] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white tracking-wide uppercase font-mono">
                      Colour Presets
                    </span>
                    <span className="text-[11px] text-cyan-400 font-mono">
                      Current: {globeSettings.colorPreset.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'ice_blue', name: 'Ice Blue', color: '#a0c4ff', isDefault: true },
                      { id: 'electric_blue', name: 'Electric Blue', color: '#3b82f6' },
                      { id: 'white', name: 'White', color: '#ffffff' },
                      { id: 'cyan', name: 'Cyan', color: '#00f0ff' },
                      { id: 'purple', name: 'Purple', color: '#a855f7' },
                      { id: 'gold', name: 'Gold', color: '#eab308' },
                    ].map((preset) => {
                      const isSelected = globeSettings.colorPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            globeSettingsService.updateSettings({ colorPreset: preset.id as GlobeColorPreset });
                            setSavedNotice(`Preset: ${preset.name}`);
                            setTimeout(() => setSavedNotice(null), 1500);
                          }}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'bg-cyan-500/15 border-cyan-500/50 text-white font-medium shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                              : 'bg-black/30 border-[#1E2638] text-slate-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                            style={{ backgroundColor: preset.color }}
                          />
                          <div className="truncate flex-1">
                            <span className="block truncate">{preset.name}</span>
                            {preset.isDefault && (
                              <span className="text-[10px] text-cyan-400 block font-mono">
                                (Default)
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Colour Picker */}
                  <div className="pt-2 border-t border-[#1C2333] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">Custom Illumination Colour:</span>
                      <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1 rounded-lg border border-[#232B3E]">
                        <input
                          type="color"
                          value={globeSettings.customColor}
                          onChange={(e) => {
                            globeSettingsService.updateSettings({
                              colorPreset: 'custom',
                              customColor: e.target.value,
                            });
                          }}
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                          title="Choose custom illumination color"
                        />
                        <span className="text-xs font-mono text-slate-300 uppercase">
                          {globeSettings.customColor}
                        </span>
                      </div>
                    </div>
                    {globeSettings.colorPreset === 'custom' && (
                      <span className="text-[11px] text-emerald-400 font-mono">
                        Active Custom Tone
                      </span>
                    )}
                  </div>
                </div>

                {/* Lighting Sliders */}
                <div className="p-4 rounded-xl bg-[#0F1422] border border-[#232B3E] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1C2333] pb-2">
                    <span className="text-xs font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Optical Calibration Sliders</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Real-time Three.js Response
                    </span>
                  </div>

                  {/* 1. Light Intensity Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Light Intensity</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(globeSettings.lightIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.05"
                      value={globeSettings.lightIntensity}
                      onChange={(e) => {
                        globeSettingsService.updateSettings({
                          lightIntensity: parseFloat(e.target.value),
                        });
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-black/50 rounded-lg appearance-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Overall master brightness and luminosity across Earth particles, rims, and reflections.
                    </p>
                  </div>

                  {/* 2. Atmospheric Glow Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Atmospheric Glow</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(globeSettings.atmosphericGlow * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.0"
                      step="0.05"
                      value={globeSettings.atmosphericGlow}
                      onChange={(e) => {
                        globeSettingsService.updateSettings({
                          atmosphericGlow: parseFloat(e.target.value),
                        });
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-black/50 rounded-lg appearance-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Controls edge Fresnel rim dispersion, outer stardust halo, and backdrop ambient mist.
                    </p>
                  </div>

                  {/* 3. Ambient Brightness Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Ambient Brightness</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(globeSettings.ambientBrightness * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="2.0"
                      step="0.05"
                      value={globeSettings.ambientBrightness}
                      onChange={(e) => {
                        globeSettingsService.updateSettings({
                          ambientBrightness: parseFloat(e.target.value),
                        });
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-black/50 rounded-lg appearance-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Controls the deep space sphere core shadow occlusion and ambient backdrop radiance.
                    </p>
                  </div>

                  {/* 4. Surface Illumination Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Surface Illumination</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(globeSettings.surfaceIllumination * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.05"
                      value={globeSettings.surfaceIllumination}
                      onChange={(e) => {
                        globeSettingsService.updateSettings({
                          surfaceIllumination: parseFloat(e.target.value),
                        });
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-black/50 rounded-lg appearance-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Modulates continent city lights particle scale, landmass intensity, and network arcs.
                    </p>
                  </div>

                  {/* 5. Orbital Light Intensity Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Orbital Light Intensity</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(globeSettings.orbitalLightIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.0"
                      step="0.05"
                      value={globeSettings.orbitalLightIntensity}
                      onChange={(e) => {
                        globeSettingsService.updateSettings({
                          orbitalLightIntensity: parseFloat(e.target.value),
                        });
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-black/50 rounded-lg appearance-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Adjusts delicate orbital trajectory curves and glowing satellite node starburst flares.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Appearance */}
            {activeSection === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 mb-1">Theme Surface Mode:</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTheme('dark');
                        document.documentElement.removeAttribute('data-theme');
                        handleSave('theme', 'dark');
                      }}
                      className={`px-4 py-2 rounded-xl transition-all ${
                        theme === 'dark' ? 'bg-sky-500 text-black font-bold' : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      Dark (Pure Black #000000 / #050508)
                    </button>
                    <button
                      onClick={() => {
                        setTheme('light');
                        document.documentElement.setAttribute('data-theme', 'light');
                        handleSave('theme', 'light');
                      }}
                      className={`px-4 py-2 rounded-xl transition-all ${
                        theme === 'light' ? 'bg-sky-500 text-black font-bold' : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      Light Canvas
                    </button>
                  </div>
                </div>

                {/* Quick Link to Globe Appearance */}
                <div className="p-4 rounded-xl bg-[#0F1422] border border-[#232B3E] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white text-xs block mb-0.5">
                      3D Earth Globe Lighting Controls
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Configure realistic atmospheric lighting, orbit intensity, and color presets.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSection('globe_appearance')}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium transition-colors"
                  >
                    Open Globe Settings →
                  </button>
                </div>
              </div>
            )}

            {/* 6. Privacy & Security */}
            {activeSection === 'privacy' && (
              <div className="space-y-3 font-sans">
                <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#232B3E]">
                  <span className="font-bold text-white block mb-1">Server-Side Credentials</span>
                  <p className="text-slate-400 text-xs">
                    All provider API keys are stored server-side. No credentials are leaked to local storage, cookies, or client responses.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#232B3E]">
                  <span className="font-bold text-white block mb-1">SSRF Protection</span>
                  <p className="text-slate-400 text-xs">
                    Network fetchers validate IP addresses and resolve hostnames, blocking access to loopback (`127.0.0.1`), metadata endpoints (`169.254.169.254`), and private subnets.
                  </p>
                </div>
              </div>
            )}

            {/* 7. Audio & Haptics */}
            {activeSection === 'audio' && (
              <div className="space-y-4 font-mono">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#0F1422] border border-[#232B3E]">
                  <span>Master Sound Effects:</span>
                  <button
                    onClick={() => {
                      const next = !audioSettings.soundEnabled;
                      audioService.updateSettings({ soundEnabled: next });
                      setAudioSettings(audioService.getSettings());
                    }}
                    className={`px-3 py-1 rounded-lg ${
                      audioSettings.soundEnabled ? 'bg-sky-500 text-black font-bold' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {audioSettings.soundEnabled ? 'Enabled' : 'Muted'}
                  </button>
                </div>
              </div>
            )}

            {/* 8. Shortcuts */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between p-2.5 rounded-lg bg-[#0F1422]">
                  <span className="text-slate-400">Open Command Palette:</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-sky-300">Ctrl + K / Cmd + K</kbd>
                </div>
                <div className="flex justify-between p-2.5 rounded-lg bg-[#0F1422]">
                  <span className="text-slate-400">Execute Search:</span>
                  <kbd className="px-2 py-0.5 rounded bg-white/10 text-sky-300">Enter</kbd>
                </div>
              </div>
            )}

            {/* 9. Usage & Observability */}
            {activeSection === 'usage' && (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#232B3E] space-y-1">
                  <div className="text-slate-400">Backend Status:</div>
                  <div className="text-emerald-400 font-bold capitalize">{connection.status}</div>
                  {connection.latencyMs && (
                    <div className="text-slate-500">Round-trip Latency: {connection.latencyMs}ms</div>
                  )}
                </div>
                {activeInfo && (
                  <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#232B3E] space-y-1">
                    <div className="text-slate-400">Active Routing Engine:</div>
                    <div className="text-sky-300 font-bold uppercase">{activeInfo.provider} ({activeInfo.model})</div>
                    {activeInfo.fallback_provider && (
                      <div className="text-amber-400">Fallback: {activeInfo.fallback_provider.toUpperCase()}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 10. About */}
            {activeSection === 'about' && (
              <div className="space-y-3 font-sans">
                <h4 className="font-bold text-white text-sm">Anvesha AI Developer Intelligence Platform</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  A high-performance source-grounded AI intelligence engine pairing live 3D Earth visualizations, spatial audio, multi-provider model routing (Gemini, Groq, OpenRouter), and a modular extension platform.
                </p>
                <div className="p-3 rounded-xl bg-[#0F1422] border border-[#1E2638] text-[11px] font-mono text-slate-400 space-y-1">
                  <div>Engine: Python 3.12 &bull; FastAPI &bull; SQLite3</div>
                  <div>Frontend: React 18 &bull; TypeScript &bull; Vite &bull; Three.js</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
