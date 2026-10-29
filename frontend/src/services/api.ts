import { HealthResponse, SearchResponse, FileContentResponse, SearchMode } from '../types/api';

export interface HealthCheckResult {
  data: HealthResponse | null;
  latencyMs: number;
  error?: string;
}

/**
 * Resolves the backend API base URL:
 * - Uses `VITE_API_BASE_URL` if defined (e.g. https://your-backend.onrender.com).
 * - Strips any trailing slashes to prevent malformed URLs.
 * - In local development (DEV mode), falls back to "http://127.0.0.1:8000".
 * - In production mode, falls back to empty string "" (relative to current origin,
 *   never hardcoding localhost into production requests).
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    // Defensive check: if the user configured the base URL with trailing "/api",
    // strip it so endpoints like `${baseUrl}/api/search` do not become `/api/api/search`.
    if (clean.endsWith('/api')) {
      clean = clean.slice(0, -4);
    }
    return clean;
  }
  // Fallback to localhost ONLY in development mode
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000';
  }
  // Production fallback: relative to current host
  return '';
}

/**
 * Fetches the backend /api/health endpoint and accurately measures
 * the actual round-trip network latency in milliseconds.
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  const baseUrl = getApiBaseUrl();
  const targetUrl = `${baseUrl}/api/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      let detail = '';
      try {
        const errorJson = await response.json();
        detail = errorJson.detail || '';
      } catch {
        // Response was not JSON
      }
      return {
        data: null,
        latencyMs,
        error: `HTTP ${response.status} (${response.statusText})${detail ? `: ${detail}` : ''}`,
      };
    }

    const data: HealthResponse = await response.json();
    return {
      data,
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    let errorMessage = 'Unknown connection error';

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        errorMessage = `Connection timed out after 6s. Backend at ${baseUrl || window.location.origin} may be cold-starting.`;
      } else {
        errorMessage = `Network error connecting to ${targetUrl}: ${err.message}`;
      }
    }

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
  const baseUrl = getApiBaseUrl();
  const targetUrl = `${baseUrl}/api/search`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for cold start / web search

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
        'Accept': 'application/json',
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
