export interface SystemTelemetry {
  python_version: string;
  os_platform: string;
  process_id: number;
  uptime_seconds: number;
  workspace_root: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  telemetry: SystemTelemetry;
}

export type ConnectionStatus = 'online' | 'connecting' | 'offline';

export interface ConnectionState {
  status: ConnectionStatus;
  latencyMs: number | null;
  lastChecked: string | null;
  data: HealthResponse | null;
  error: string | null;
}

export type SearchMode = 'auto' | 'code' | 'web';

export interface SearchResultItem {
  file_path: string;
  relative_path: string;
  line_number: number;
  column: number;
  match_type: 'symbol' | 'filename' | 'content';
  symbol_name?: string | null;
  snippet: string;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source_domain: string;
}

export interface SearchResponse {
  query: string;
  mode_requested: SearchMode;
  mode_used: 'code' | 'web';
  routing_reason?: string | null;
  total_matches: number;
  workspace_root: string;
  results: SearchResultItem[];
  web_results?: WebSearchResultItem[];
  web_error?: string | null;
}

export interface FileContentResponse {
  relative_path: string;
  file_name: string;
  content: string;
  total_lines: number;
  size_bytes: number;
  extension: string;
}

export type ActiveView = 'search' | 'dashboard';
