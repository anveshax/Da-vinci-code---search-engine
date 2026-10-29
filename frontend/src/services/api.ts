import { HealthResponse, SearchResponse, FileContentResponse, SearchMode } from '../types/api';

export interface HealthCheckResult {
  data: HealthResponse | null;
  latencyMs: number;
  error?: string;
}

/**
 * Fetches the backend /api/health endpoint and accurately measures
 * the actual round-trip network latency in milliseconds.
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const response = await fetch('/api/health', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        data: null,
        latencyMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data: HealthResponse = await response.json();
    return {
      data,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : 'Unknown connection error';
    return {
      data: null,
      latencyMs,
      error: errorMessage,
    };
  }
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
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, mode, max_results: maxResults }),
  });

  if (!response.ok) {
    throw new Error(`Search failed with status ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Retrieves the raw content of any file inside the workspace for code inspection.
 */
export async function getFileContent(relativePath: string): Promise<FileContentResponse> {
  const params = new URLSearchParams({ path: relativePath });
  const response = await fetch(`/api/file/content?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load file content: ${response.statusText}`);
  }

  return response.json();
}
