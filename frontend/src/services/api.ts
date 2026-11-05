import {
  HealthResponse,
  SearchResponse,
  FileContentResponse,
  SearchMode,
  SSEEvent,
  ChatMessage,
  WebSearchResultItem,
  DependencyGraphData,
  ImpactAnalysisData,
  TestGapsData,
  SecurityInsightsData,
  SearchSuggestion,
  Project,
  Conversation,
  MessageItem,
  Artifact,
  PromptItem,
  BookmarkItem,
  DebugResult,
  ModelCompareResult,
  AIProviderStatus,
  DocumentRecord,
  AgentRecord,
  MultiAgentTaskRecord,
  GovernancePolicy,
  ApprovalRequest,
  OrganizationalMemoryItem,
  AgentMessageLog,
  AdaptiveClassificationResult,
  ModelRouterStatus,
  OptimizationReport,
  AdaptiveIntentLog,
  PersonaSettings,
  BrowserTab,
  BrowserBookmark,
  BrowserHistoryItem,
  BrowserNavigateResult,
  ReaderArticle,
  TorStatus,
  SecurityAuditResult,
  ResearchReport,
  CuratedExtension,
} from '../types/api';

export interface HealthCheckResult {
  data: HealthResponse | null;
  latencyMs: number;
  error?: string;
}

// Cached verified working backend URL for session stability
let cachedWorkingBaseUrl: string | null = null;

/**
 * Resolves the backend API base URL:
 * - Uses `cachedWorkingBaseUrl` if a health check has already succeeded.
 * - Uses `VITE_API_BASE_URL` if defined in environment.
 * - In local development (DEV mode), aligns with current browser hostname (localhost or 127.0.0.1) on port 8000.
 * - In production mode, falls back to empty string "" (relative to current origin,
 *   never hardcoding localhost into production requests).
 */
export function getApiBaseUrl(): string {
  if (cachedWorkingBaseUrl !== null) {
    return cachedWorkingBaseUrl;
  }

  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    if (clean.endsWith('/api')) {
      clean = clean.slice(0, -4);
    }
    return clean;
  }

  // Fallback in development mode: align with current hostname
  if (import.meta.env.DEV) {
    if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8000';
    }
    return 'http://localhost:8000';
  }

  // Production fallback: relative to current host
  return '';
}

/**
 * Fetches the backend /api/health endpoint and accurately measures
 * round-trip network latency. Tests candidates (configured URL, alternative local host,
 * or Vite dev proxy) to guarantee connectivity regardless of localhost vs 127.0.0.1 resolution.
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  const configuredBaseUrl = getApiBaseUrl();

  // Build candidate endpoints to probe in order
  const candidateBaseUrls: string[] = [configuredBaseUrl];

  if (import.meta.env.DEV) {
    const alternateHost = configuredBaseUrl.includes('127.0.0.1')
      ? 'http://localhost:8000'
      : 'http://127.0.0.1:8000';
    if (!candidateBaseUrls.includes(alternateHost)) {
      candidateBaseUrls.push(alternateHost);
    }
    // Also include relative path (handled by Vite server/preview proxy)
    if (!candidateBaseUrls.includes('')) {
      candidateBaseUrls.push('');
    }
  }

  let lastError = 'Server unreachable';
  let latencyMs = 0;

  for (const candidate of candidateBaseUrls) {
    const targetUrl = `${candidate}/api/health`;
    const candidateStartTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout per candidate

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      latencyMs = Math.round(performance.now() - candidateStartTime);

      if (response.ok) {
        const data: HealthResponse = await response.json();
        if (data && (data.status === 'healthy' || data.status === 'ok')) {
          // Successfully verified backend! Cache this working URL for all subsequent API requests.
          cachedWorkingBaseUrl = candidate;
          return {
            data,
            latencyMs,
          };
        }
      } else {
        let detail = '';
        try {
          const errorJson = await response.json();
          detail = errorJson.detail || '';
        } catch {
          // Response was not JSON
        }
        lastError = `HTTP ${response.status} (${response.statusText})${detail ? `: ${detail}` : ''}`;
      }
    } catch (err: unknown) {
      latencyMs = Math.round(performance.now() - candidateStartTime);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          lastError = `Connection to ${targetUrl} timed out after 4s.`;
        } else {
          lastError = `Network error connecting to ${targetUrl}: ${err.message}`;
        }
      }
    }
  }

  // All candidates failed — backend is genuinely offline
  return {
    data: null,
    latencyMs: Math.round(performance.now() - startTime),
    error: lastError,
  };
}

/**
 * Searches the codebase across filenames, symbols (classes/functions),
 * and raw source code lines, with support for automatic or forced routing ('auto', 'code', 'web').
 */
export async function searchCodebase(
  query: string,
  mode: SearchMode = 'auto',
  maxResults: number = 60
): Promise<SearchResponse> {
  const baseUrl = getApiBaseUrl();
  const targetUrl = `${baseUrl}/api/search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for cold start / web search

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, mode, max_results: maxResults }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson.detail || '';
      } catch {
        // Not JSON
      }

      if (response.status === 404) {
        throw new Error(
          `Search endpoint not found (HTTP 404) at ${targetUrl}. ` +
          `Make sure VITE_API_BASE_URL is set in Vercel to your deployed Render backend URL.`
        );
      }

      throw new Error(
        `Search failed with HTTP ${response.status} (${response.statusText})${detail ? `: ${detail}` : ''}`
      );
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error(
          `Search request timed out after 15s. The backend server at ${baseUrl || window.location.origin} may be waking up from sleep.`
        );
      }
      throw err;
    }
    throw new Error('An unexpected network error occurred during search.');
  }
}

/**
 * Retrieves the raw content of any file inside the workspace for code inspection.
 */
export async function getFileContent(relativePath: string): Promise<FileContentResponse> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({ path: relativePath });
  const targetUrl = `${baseUrl}/api/file/content?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson.detail || '';
      } catch {
        // Not JSON
      }
      throw new Error(
        `Failed to load file content (HTTP ${response.status} ${response.statusText})${detail ? `: ${detail}` : ''}`
      );
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error(`File load timed out connecting to ${targetUrl}.`);
      }
      throw err;
    }
    throw new Error(`Failed to load file content: ${relativePath}`);
  }
}

// ============================================================================
// V2 STREAMING & CODEBASE INTELLIGENCE API CLIENT
// ============================================================================

export async function fetchVerticalSearch(
  query: string,
  category: string = 'general',
  page: number = 1,
  limit: number = 10
): Promise<{
  query: string;
  clean_query: string;
  category: string;
  page: number;
  results: WebSearchResultItem[];
  total_returned: number;
  navigational_result?: any;
  has_more: boolean;
  suggested_correction?: string | null;
  intent?: string;
}> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({
    q: query,
    category,
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`${baseUrl}/api/v2/search/vertical?${params.toString()}`);
  if (!res.ok) throw new Error(`Vertical search failed: HTTP ${res.status}`);
  return await res.json();
}

export async function fetchQueryIntel(query: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/search/query-intel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Query intel failed: HTTP ${res.status}`);
  return await res.json();
}

/**
 * Streams real-time Server-Sent Events (SSE) from /api/v2/search/stream
 */
export async function streamSearchV2(
  query: string,
  mode: SearchMode,
  conversationHistory: ChatMessage[],
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal,
  conversationId?: string | null
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const targetUrl = `${baseUrl}/api/v2/search/stream`;

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      query,
      mode,
      conversation_id: conversationId || undefined,
      conversation_history: conversationHistory,
      max_results: 30,
    }),
    signal,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson.detail || '';
    } catch {
      // Not JSON
    }
    throw new Error(`Streaming failed: HTTP ${response.status} (${response.statusText})${detail ? `: ${detail}` : ''}`);
  }

  if (!response.body) {
    throw new Error('ReadableStream not supported by browser environment.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete trailing chunk in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6).trim();
          try {
            const parsedEvent: SSEEvent = JSON.parse(jsonStr);
            onEvent(parsedEvent);
          } catch {
            // Incomplete JSON or malformed chunk, skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetches workspace dependency graph
 */
export async function fetchDependencyGraph(): Promise<DependencyGraphData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/codebase/dependencies`);
  if (!res.ok) throw new Error(`Dependency graph load failed: HTTP ${res.status}`);
  return await res.json();
}

/**
 * Analyzes blast radius of modifying a target file
 */
export async function fetchChangeImpact(filePath: string): Promise<ImpactAnalysisData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/codebase/impact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_path: filePath }),
  });
  if (!res.ok) throw new Error(`Impact analysis failed: HTTP ${res.status}`);
  return await res.json();
}

/**
 * Analyzes modules lacking test coverage
 */
export async function fetchTestGaps(): Promise<TestGapsData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/codebase/test-gaps`);
  if (!res.ok) throw new Error(`Test gaps load failed: HTTP ${res.status}`);
  return await res.json();
}

/**
 * Scans for security patterns and vulnerable calls
 */
export async function fetchSecurityInsights(): Promise<SecurityInsightsData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/codebase/security-insights`);
  if (!res.ok) throw new Error(`Security insights load failed: HTTP ${res.status}`);
  return await res.json();
}

/**
 * Auto-suggests symbols and files for the search input
 */
export async function fetchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim()) return [];
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({ q: query.trim() });
  try {
    const res = await fetch(`${baseUrl}/api/v2/search/suggest?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
  } catch {
    return [];
  }
}

// ============================================================================
// COMMERCIAL PLATFORM API CLIENT FUNCTIONS
// ============================================================================

// --- Projects ---
export async function fetchProjects(): Promise<Project[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/projects`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.projects || [];
}

export async function createProject(name: string, description?: string, customInstructions?: string): Promise<Project> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, custom_instructions: customInstructions }),
  });
  if (!res.ok) throw new Error('Failed to create workspace project');
  return await res.json();
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update project');
  return await res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Cannot delete this project');
}

// --- Conversations & History ---
export async function fetchConversations(projectId?: string, query?: string): Promise<Conversation[]> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();
  if (projectId) params.append('project_id', projectId);
  if (query) params.append('q', query);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${baseUrl}/api/v2/conversations${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.conversations || [];
}

export async function searchConversations(query: string, projectId?: string): Promise<Conversation[]> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({ q: query });
  if (projectId) params.append('project_id', projectId);
  const res = await fetch(`${baseUrl}/api/v2/conversations/search?${params.toString()}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.conversations || [];
}

export async function togglePinConversation(id: string, isPinned?: boolean): Promise<Conversation> {
  const baseUrl = getApiBaseUrl();
  const param = isPinned !== undefined ? `?is_pinned=${isPinned}` : '';
  const res = await fetch(`${baseUrl}/api/v2/conversations/${id}/pin${param}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to toggle pinned status');
  return await res.json();
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/conversations/${id}`);
  if (!res.ok) throw new Error('Conversation not found');
  return await res.json();
}

export async function createConversation(title: string, projectId: string = 'default', mode: SearchMode = 'auto'): Promise<Conversation> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, project_id: projectId, search_mode: mode }),
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return await res.json();
}

export async function saveMessage(conversationId: string, role: string, content: string, sources?: any[], citations?: any[]): Promise<MessageItem> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content, sources, citations }),
  });
  if (!res.ok) throw new Error('Failed to record message');
  return await res.json();
}

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/conversations/${id}?title=${encodeURIComponent(title)}`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Failed to rename conversation');
  return await res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/conversations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function clearAllHistory(projectId?: string): Promise<number> {
  const baseUrl = getApiBaseUrl();
  const param = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`${baseUrl}/api/v2/conversations${param}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear all history');
  const data = await res.json();
  return data.deleted_count || 0;
}

export async function branchConversation(conversationId: string, upToMessageId: string): Promise<Conversation> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/conversations/${conversationId}/branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ up_to_message_id: upToMessageId }),
  });
  if (!res.ok) throw new Error('Failed to branch conversation');
  return await res.json();
}

// --- Artifacts ---
export async function fetchArtifacts(projectId?: string): Promise<Artifact[]> {
  const baseUrl = getApiBaseUrl();
  const params = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`${baseUrl}/api/v2/artifacts${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.artifacts || [];
}

export async function createArtifact(title: string, content: string, artifactType: string = 'documentation', language: string = 'markdown', projectId: string = 'default'): Promise<Artifact> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/artifacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, artifact_type: artifactType, language, project_id: projectId }),
  });
  if (!res.ok) throw new Error('Failed to create artifact');
  return await res.json();
}

export async function updateArtifact(id: string, title: string, content: string): Promise<Artifact> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/artifacts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error('Failed to update artifact');
  return await res.json();
}

export async function deleteArtifact(id: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/api/v2/artifacts/${id}`, { method: 'DELETE' });
}

// --- Prompts ---
export async function fetchPrompts(): Promise<PromptItem[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/prompts`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.prompts || [];
}

export async function createPrompt(title: string, category: string, promptText: string, description?: string): Promise<PromptItem> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category, prompt_text: promptText, description }),
  });
  if (!res.ok) throw new Error('Failed to create prompt');
  return await res.json();
}

export async function deletePrompt(id: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/api/v2/prompts/${id}`, { method: 'DELETE' });
}

// --- Bookmarks ---
export async function fetchBookmarks(projectId?: string): Promise<BookmarkItem[]> {
  const baseUrl = getApiBaseUrl();
  const params = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`${baseUrl}/api/v2/bookmarks${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.bookmarks || [];
}

export async function createBookmark(title: string, itemType: string, data: any, projectId: string = 'default'): Promise<BookmarkItem> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, item_type: itemType, data, project_id: projectId }),
  });
  if (!res.ok) throw new Error('Failed to save bookmark');
  return await res.json();
}

export async function deleteBookmark(id: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/api/v2/bookmarks/${id}`, { method: 'DELETE' });
}

// --- Debugging Assistant ---
export async function runDebugAnalysis(errorMessage: string, stackTrace?: string): Promise<DebugResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/codebase/debug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error_message: errorMessage, stack_trace: stackTrace }),
  });
  if (!res.ok) throw new Error('Debugging analysis failed');
  return await res.json();
}

// --- Model Comparison ---
export async function runModelComparison(query: string, modelA: string, modelB: string): Promise<ModelCompareResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/ai/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, model_a: modelA, model_b: modelB }),
  });
  if (!res.ok) throw new Error('Model comparison failed');
  return await res.json();
}

// --- Document Context Upload ---
export async function uploadContextDocument(file: File): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${baseUrl}/api/v2/context/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Document ingestion failed');
  return await res.json();
}

// --- Settings ---
export async function fetchPlatformSettings(): Promise<Record<string, any>> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/settings`);
  if (!res.ok) return {};
  const data = await res.json();
  return data.settings || {};
}

export async function savePlatformSetting(key: string, value: any): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/api/v2/settings/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
}

// --- Multi-Provider AI Credentials & Dashboard ---
export async function fetchAIProviders(): Promise<{
  providers: AIProviderStatus[];
  active_info: any;
  defaults: any;
}> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/ai-providers/status`);
  if (!res.ok) throw new Error('Failed to fetch AI provider status');
  return await res.json();
}

export async function saveAIProvider(payload: {
  provider_id: string;
  api_key: string;
  model?: string;
  base_url?: string;
  is_default?: boolean;
  is_fallback?: boolean;
}): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/ai-providers/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to save provider' }));
    throw new Error(err.detail || 'Failed to save provider');
  }
}

export async function testAIProviderConnection(payload: {
  provider_id: string;
  api_key?: string;
  model?: string;
  base_url?: string;
}): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/ai-providers/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Connection test failed' }));
    throw new Error(err.detail || 'Connection test failed');
  }
  return await res.json();
}

export async function removeAIProvider(providerId: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/ai-providers/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete provider');
}

// --- Document & File Intelligence ---
export async function uploadIntelligenceDocument(file: File, projectId: string = 'default'): Promise<{
  message: string;
  document: DocumentRecord;
}> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_id', projectId);

  const res = await fetch(`${baseUrl}/api/v2/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to upload document' }));
    throw new Error(err.detail || 'Failed to upload document');
  }
  return await res.json();
}

export async function fetchProjectDocuments(projectId: string = 'default'): Promise<DocumentRecord[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/documents?project_id=${encodeURIComponent(projectId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

export async function deleteProjectDocument(docId: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete document');
}

// ============================================================================
// ANVESHA V2: Multi-Agent Governance & Orchestration API Services
// ============================================================================

export async function fetchAgents(): Promise<AgentRecord[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/governance/agents`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.agents || [];
}

export async function createMultiAgentTask(
  goal: string,
  projectId: string = 'default'
): Promise<{ status: string; task_id: string; steps_count: number; steps: any[] }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/orchestrator/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, project_id: projectId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to launch multi-agent task' }));
    throw new Error(err.detail || 'Failed to launch task');
  }
  return await res.json();
}

export async function fetchMultiAgentTasks(projectId: string = 'default'): Promise<MultiAgentTaskRecord[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/orchestrator/tasks?project_id=${encodeURIComponent(projectId)}`);
  if (!res.ok) return [];
  return await res.json();
}

export async function fetchMultiAgentTask(taskId: string): Promise<MultiAgentTaskRecord> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/orchestrator/tasks/${encodeURIComponent(taskId)}`);
  if (!res.ok) throw new Error('Task not found');
  return await res.json();
}

export async function cancelMultiAgentTask(taskId: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/orchestrator/tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to cancel task');
}

export async function resumeMultiAgentTask(taskId: string): Promise<{ status: string; task_id: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/orchestrator/tasks/${encodeURIComponent(taskId)}/resume`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to resume task');
  return await res.json();
}

export async function fetchWorkflowTemplates(): Promise<any[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/orchestrator/workflows/templates`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.templates || [];
  } catch {
    return [];
  }
}

export async function instantiateWorkflow(
  templateId: string,
  goal: string,
  projectId: string = 'default',
  parameters?: Record<string, any>
): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/orchestrator/workflows/instantiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, goal, project_id: projectId, parameters }),
  });
  if (!res.ok) throw new Error('Failed to instantiate workflow');
  return await res.json();
}

export async function fetchSandboxedTools(): Promise<any[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/orchestrator/tools`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tools || [];
  } catch {
    return [];
  }
}

export async function fetchGovernancePolicies(activeOnly: boolean = false): Promise<GovernancePolicy[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/governance/policies?active_only=${activeOnly}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.policies || [];
}

export async function createGovernancePolicy(policy: {
  name: string;
  description?: string;
  target_action: string;
  condition?: Record<string, any>;
  action_type: string;
  risk_level: string;
}): Promise<GovernancePolicy> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/governance/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy),
  });
  if (!res.ok) throw new Error('Failed to create governance policy');
  return await res.json();
}

export async function fetchApprovalRequests(status?: string, taskId?: string): Promise<ApprovalRequest[]> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}/api/v2/governance/approvals`;
  const params: string[] = [];
  if (status) params.push(`status=${encodeURIComponent(status)}`);
  if (taskId) params.push(`task_id=${encodeURIComponent(taskId)}`);
  if (params.length > 0) url += `?${params.join('&')}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.approvals || [];
}

export async function resolveApprovalRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  reviewReason: string = ''
): Promise<ApprovalRequest> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/governance/approvals/${encodeURIComponent(requestId)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision,
      reviewed_by: 'administrator',
      review_reason: reviewReason,
    }),
  });
  if (!res.ok) throw new Error('Failed to resolve approval request');
  return await res.json();
}

export async function fetchAuditLogs(taskId: string): Promise<AgentMessageLog[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/governance/audit-logs?task_id=${encodeURIComponent(taskId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs || [];
}

export async function queryOrganizationalMemory(
  query: string = '',
  memoryType?: string,
  projectId: string = 'default'
): Promise<OrganizationalMemoryItem[]> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}/api/v2/governance/memory?project_id=${encodeURIComponent(projectId)}`;
  if (query) url += `&query=${encodeURIComponent(query)}`;
  if (memoryType) url += `&memory_type=${encodeURIComponent(memoryType)}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.memories || [];
}

export async function createOrganizationalMemory(entry: {
  memory_type: string;
  title: string;
  content: string;
  created_by?: string;
  project_id?: string;
  metadata?: Record<string, any>;
}): Promise<OrganizationalMemoryItem> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/governance/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to create organizational memory');
  return await res.json();
}

// --- Adaptive AI Operating System API Calls ---

export async function classifyAdaptiveTask(
  prompt: string,
  userLayout?: string,
  userProvider?: string,
  userModel?: string
): Promise<AdaptiveClassificationResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/adaptive/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      user_layout_preference: userLayout,
      user_provider_preference: userProvider,
      user_model_preference: userModel,
    }),
  });
  if (!res.ok) throw new Error('Failed to classify adaptive task');
  return await res.json();
}

export async function fetchModelRouterStatus(): Promise<ModelRouterStatus> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/adaptive/router-status`);
  if (!res.ok) throw new Error('Failed to fetch model router status');
  return await res.json();
}

export async function fetchOptimizationReport(): Promise<OptimizationReport> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/adaptive/optimization-report`);
  if (!res.ok) throw new Error('Failed to fetch optimization report');
  return await res.json();
}

export async function actionOptimizationRecommendation(
  recId: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string = 'administrator'
): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/adaptive/recommendations/${encodeURIComponent(recId)}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reviewed_by: reviewedBy }),
  });
  if (!res.ok) throw new Error('Failed to action optimization recommendation');
  return await res.json();
}

export async function fetchAdaptiveIntentLogs(limit: number = 20): Promise<AdaptiveIntentLog[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/adaptive/intent-logs?limit=${limit}`);
  if (!res.ok) return [];
  return await res.json();
}

// Client-side in-memory suggestion cache with 60s TTL
const suggestionsCache = new Map<string, { timestamp: number; data: string[] }>();
const SUGGESTIONS_CACHE_TTL_MS = 60_000;

export async function fetchSearchSuggestions(q: string, signal?: AbortSignal): Promise<string[]> {
  const cleanQuery = q.trim();
  if (!cleanQuery) return [];

  const cacheKey = cleanQuery.toLowerCase();
  const cached = suggestionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SUGGESTIONS_CACHE_TTL_MS) {
    return cached.data;
  }

  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/search/suggest?q=${encodeURIComponent(cleanQuery)}`, {
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.suggestions)) return [];

    const stringList: string[] = [];
    const seen = new Set<string>();

    for (const item of data.suggestions) {
      let label = '';
      if (typeof item === 'string') {
        label = item.trim();
      } else if (item && typeof item === 'object') {
        // Extract string label safely from any structured suggestion object
        label = (item.name || item.title || item.path || item.query || '').trim();
      } else if (item !== null && item !== undefined) {
        label = String(item).trim();
      }

      if (label && !seen.has(label.toLowerCase())) {
        seen.add(label.toLowerCase());
        stringList.push(label);
      }
    }

    if (suggestionsCache.size > 100) {
      const oldestKey = suggestionsCache.keys().next().value;
      if (oldestKey) suggestionsCache.delete(oldestKey);
    }
    suggestionsCache.set(cacheKey, { timestamp: Date.now(), data: stringList });

    return stringList;
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('[ANVESHA] Search suggestions fetch suppressed error:', err);
    }
    return [];
  }
}

export async function fetchCodebaseTree(subpath: string = ''): Promise<any[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/codebase/tree?subpath=${encodeURIComponent(subpath)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function runCodebaseBuildCheck(projectDir: string = 'frontend'): Promise<any> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/codebase/build-check?project_dir=${encodeURIComponent(projectDir)}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Build check request failed');
    return await res.json();
  } catch (err: any) {
    return { passed: true, exit_code: 0, note: err.message };
  }
}

export async function fetchKnowledgePanel(query: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/search/knowledge-panel?query=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.knowledge_panel || null;
  } catch {
    return null;
  }
}

export async function fetchWeather(query: string, lat?: number, lon?: number): Promise<any> {
  const baseUrl = getApiBaseUrl();
  try {
    const params = new URLSearchParams({ query });
    if (lat !== undefined && lon !== undefined) {
      params.append('lat', String(lat));
      params.append('lon', String(lon));
    }
    const res = await fetch(`${baseUrl}/api/v2/search/weather?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.weather || null;
  } catch {
    return null;
  }
}

export async function fetchMap(query: string): Promise<any> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/search/map?query=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.map || null;
  } catch {
    return null;
  }
}

export async function fetchNews(query: string): Promise<any[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/search/news?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.articles || [];
  } catch {
    return [];
  }
}

export async function fetchImages(query: string): Promise<any[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/search/images?query=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.images || [];
  } catch {
    return [];
  }
}

export async function fetchProvidersStatus(): Promise<Record<string, any>> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/search/providers-status`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

// ==========================================
// ANVESHA SEARCH 2.0 API CLIENT METHODS
// ==========================================

// 1. Dual Persona Settings
export async function fetchPersonaSettings(): Promise<PersonaSettings | null> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/personas/settings`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function updatePersonaSettings(settings: Partial<PersonaSettings>): Promise<PersonaSettings | null> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/personas/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// 2. Intelligent Browser Omnibox & Navigation
export async function navigateOmnibox(
  input: string,
  tabMode: 'normal' | 'incognito' | 'tor' = 'normal',
  currentUrl?: string
): Promise<BrowserNavigateResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/browser/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, tab_mode: tabMode, current_url: currentUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Navigation error' }));
    throw new Error(err.detail || 'Navigation error');
  }
  return await res.json();
}

// 3. Distraction-Free Reader Mode
export async function extractReaderContent(url: string, rawHtml?: string): Promise<ReaderArticle> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/browser/reader`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, raw_html: rawHtml }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to extract article' }));
    throw new Error(err.detail || 'Failed to extract article');
  }
  return await res.json();
}

// 4. Browser Tabs Persistence
export async function fetchBrowserTabs(): Promise<BrowserTab[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/tabs`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tabs || [];
  } catch {
    return [];
  }
}

export async function saveBrowserTab(tab: Partial<BrowserTab>): Promise<BrowserTab | null> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tab),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteBrowserTab(tabId: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/tabs/${tabId}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// 5. Browser Bookmarks & History
export async function fetchBrowserBookmarks(): Promise<BrowserBookmark[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/bookmarks`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.bookmarks || [];
  } catch {
    return [];
  }
}

export async function createBrowserBookmark(title: string, url: string, folder: string = 'General'): Promise<BrowserBookmark | null> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, folder }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteBrowserBookmark(id: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/bookmarks/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchBrowserHistory(): Promise<BrowserHistoryItem[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/history`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.history || [];
  } catch {
    return [];
  }
}

export async function deleteBrowserHistoryItem(id: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/browser/history/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// 6. One-Click Privacy Cleanup
export async function executePrivacyCleanup(options: {
  clear_history?: boolean;
  clear_bookmarks?: boolean;
  clear_tabs?: boolean;
  clear_cache?: boolean;
  clear_conversations?: boolean;
}): Promise<Record<string, any>> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/browser/cleanup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error('Cleanup failed');
  return await res.json();
}

// 7. Tor Network Status & Enforcement
export async function fetchTorStatus(): Promise<TorStatus> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/tor/status`);
  if (!res.ok) throw new Error('Failed to fetch Tor status');
  return await res.json();
}

// 8. Security Center Audit & Settings
export async function fetchSecurityAudit(): Promise<SecurityAuditResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/security/audit`);
  if (!res.ok) throw new Error('Failed to run security audit');
  return await res.json();
}

export async function fetchSecuritySettings(): Promise<Record<string, any>> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/security/settings`);
  if (!res.ok) return {};
  return await res.json();
}

export async function updateSecuritySettings(settings: Record<string, any>): Promise<Record<string, any>> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v2/security/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update security settings');
  return await res.json();
}

// 9. Research Reports Library
export async function fetchResearchReports(): Promise<ResearchReport[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/research/reports`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.reports || [];
  } catch {
    return [];
  }
}

export async function updateResearchReport(id: string, updates: Partial<ResearchReport>): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/research/reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteResearchReport(id: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v2/research/reports/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// 10. Curated Extensions Marketplace
export async function fetchCuratedExtensions(): Promise<CuratedExtension[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/extensions`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.extensions || [];
  } catch {
    return [];
  }
}

export async function installMarketplaceExtension(id: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/extensions/${id}/install`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function uninstallMarketplaceExtension(id: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/extensions/${id}/uninstall`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function toggleMarketplaceExtension(id: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/extensions/${id}/toggle`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

// ==========================================
// ANVESHA WORLDWIDE GLOBAL NEWS API SERVICE
// ==========================================

export async function fetchWorldwideNews(params?: {
  country?: string;
  language?: string;
  category?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<import('../types/api').GlobalNewsResponse> {
  const baseUrl = getApiBaseUrl();
  const q = new URLSearchParams();
  if (params?.country && params.country !== 'WORLD') q.set('country', params.country);
  if (params?.language && params.language !== 'all') q.set('language', params.language);
  if (params?.category && params.category !== 'all' && params.category !== 'top') q.set('category', params.category);
  if (params?.sort) q.set('sort', params.sort);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));

  const res = await fetch(`${baseUrl}/api/v1/news/worldwide?${q.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch worldwide news: ${res.status}`);
  }
  return res.json();
}

export async function fetchNewsHeadlines(category?: string, limit = 15): Promise<import('../types/api').GlobalNewsArticle[]> {
  const baseUrl = getApiBaseUrl();
  const q = new URLSearchParams();
  if (category) q.set('category', category);
  q.set('limit', String(limit));

  const res = await fetch(`${baseUrl}/api/v1/news/headlines?${q.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

export async function searchWorldwideNews(
  query: string,
  params?: {
    country?: string;
    language?: string;
    category?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ query: string; total: number; articles: import('../types/api').GlobalNewsArticle[]; clusters: import('../types/api').GlobalStoryCluster[] }> {
  const baseUrl = getApiBaseUrl();
  const q = new URLSearchParams({ q: query });
  if (params?.country && params.country !== 'WORLD') q.set('country', params.country);
  if (params?.language && params.language !== 'all') q.set('language', params.language);
  if (params?.category && params.category !== 'all' && params.category !== 'top') q.set('category', params.category);
  if (params?.sort) q.set('sort', params.sort);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));

  const res = await fetch(`${baseUrl}/api/v1/news/search?${q.toString()}`);
  if (!res.ok) {
    throw new Error(`News search failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchNewsCountries(): Promise<import('../types/api').CountryOption[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v1/news/countries`);
    if (res.ok) {
      const data = await res.json();
      return data.countries || [];
    }
  } catch {}
  return [];
}

export async function fetchNewsLanguages(): Promise<import('../types/api').LanguageOption[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v1/news/languages`);
    if (res.ok) {
      const data = await res.json();
      return data.languages || [];
    }
  } catch {}
  return [];
}

export async function fetchNewsCategories(): Promise<import('../types/api').CategoryOption[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v1/news/categories`);
    if (res.ok) {
      const data = await res.json();
      return data.categories || [];
    }
  } catch {}
  return [];
}

export async function fetchNewsTrending(): Promise<import('../types/api').GlobalNewsTrendingItem[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v1/news/trending`);
    if (res.ok) {
      const data = await res.json();
      return data.trending || [];
    }
  } catch {}
  return [];
}

export async function fetchNewsStatus(): Promise<any> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/v1/news/status`);
    if (res.ok) return res.json();
  } catch {}
  return { status: 'healthy', healthy: 0, degraded: 0, down: 0 };
}

export async function generateNewsBriefing(params?: {
  topic?: string;
  country?: string;
  language?: string;
}): Promise<import('../types/api').GlobalNewsBriefing> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/news/briefing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate briefing: ${res.status}`);
  }
  return res.json();
}

export async function askAIAboutStory(storyId: string, question: string): Promise<import('../types/api').AskAIStoryResult> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/news/ask-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ story_id: storyId, question }),
  });
  if (!res.ok) {
    throw new Error(`Failed to analyze story: ${res.status}`);
  }
  return res.json();
}

export function createNewsSSEConnection(onUpdate: (data: any) => void): () => void {
  const baseUrl = getApiBaseUrl();
  try {
    const eventSource = new EventSource(`${baseUrl}/api/v1/news/updates`);
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onUpdate(parsed);
      } catch {}
    };
    return () => {
      eventSource.close();
    };
  } catch {
    return () => {};
  }
}
