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

// Intelligent Search Modes
export type SearchMode = 'auto' | 'code' | 'web' | 'news' | 'deep' | 'direct';

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
  is_official?: boolean;
  sitelinks?: Array<{ title: string; url: string }>;
  published_date?: string | null;
  score?: number;
}

export interface NavigationalResultData {
  title: string;
  url: string;
  domain: string;
  site_name: string;
  snippet: string;
  is_official: boolean;
  verified_badge: boolean;
  sitelinks?: Array<{ title: string; url: string }>;
}

export interface DocumentCitationItem {
  type: 'document';
  title: string;
  location?: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  mode_requested: SearchMode;
  mode_used: 'code' | 'web' | 'deep' | 'direct';
  routing_reason?: string | null;
  provider_used?: string | null;
  model_used?: string | null;
  total_matches: number;
  workspace_root: string;
  results: SearchResultItem[];
  web_results?: WebSearchResultItem[];
  navigational_result?: NavigationalResultData | null;
  web_error?: string | null;
  initial_answer?: string;
  initial_conversation?: ChatMessage[];
}

export interface FileContentResponse {
  relative_path: string;
  file_name: string;
  content: string;
  total_lines: number;
  size_bytes: number;
  extension: string;
}

export type ActiveView =
  | 'search'
  | 'results'
  | 'news'
  | 'browser'
  | 'history'
  | 'web_intelligence'
  | 'web_studio'
  | 'explorer'
  | 'deep_research'
  | 'multi_agent'
  | 'governance'
  | 'dependencies'
  | 'impact'
  | 'debugging'
  | 'test_gaps'
  | 'security'
  | 'artifacts'
  | 'prompts'
  | 'bookmarks'
  | 'settings'
  | 'extensions'
  | 'dashboard';

// --- Web Intelligence & Crawler Types ---

export interface CrawlerOverviewStats {
  total_discovered: number;
  crawled_pages: number;
  indexed_documents: number;
  failed_urls: number;
  pending_urls: number;
  active_jobs: number;
  active_domains: number;
  requests_per_minute: number;
  last_crawl_timestamp: number | null;
  crawler_status: 'active' | 'idle' | 'paused';
}

export interface CrawlerDomainItem {
  id: string;
  domain: string;
  enabled: boolean | number;
  allowed_paths: string[];
  crawl_delay_sec: number;
  max_depth: number;
  max_pages: number;
  robots_txt_status: string;
  total_crawled: number;
  last_crawled_at: number | null;
  created_at: number;
}

export interface CrawlerJobItem {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  target_domains: string[];
  total_discovered: number;
  total_crawled: number;
  total_indexed: number;
  total_failed: number;
  total_skipped: number;
  current_url?: string;
  progress_percent: number;
  started_at: number | null;
  finished_at: number | null;
  error_message?: string;
  config?: {
    max_pages?: number;
    max_depth?: number;
    target_domains?: string[];
  };
  queue_sample?: Array<{
    url: string;
    status: string;
    http_status?: number;
    error_message?: string;
    depth: number;
    completed_at?: number;
  }>;
  created_at: number;
}

export interface CrawledDocumentItem {
  id: string;
  url: string;
  canonical_url: string;
  domain: string;
  title: string;
  description: string;
  headings?: string[];
  content?: string;
  language: string;
  author?: string;
  word_count: number;
  crawl_timestamp: number;
  score?: number;
  snippet?: string;
}

export interface CrawlerMonitoringMetrics {
  requests_per_minute: number;
  status_distribution: Record<string, number>;
  top_crawled_domains: Array<{ domain: string; count: number }>;
  average_word_count: number;
  average_content_length: number;
}

// --- V2 AI Streaming & Research Types ---

export interface CitationItem {
  type: 'code' | 'web';
  title: string;
  file_path?: string;
  line_number?: number;
  symbol_name?: string | null;
  url?: string;
  domain?: string;
  snippet: string;
}

export interface StatusEventData {
  phase: string;
  message: string;
}

export interface SourcesEventData {
  mode_used: string;
  routing_reason?: string | null;
  code_results: SearchResultItem[];
  web_results: WebSearchResultItem[];
  navigational_result?: NavigationalResultData | null;
  web_error?: string | null;
  suggested_correction?: string | null;
  intent?: string;
  page?: number;
  category?: string;
  total_matches: number;
}

export interface CompletedEventData {
  conversation_id?: string;
  total_sources: number;
  citations_count: number;
  duration_ms: number;
  mode_used: string;
  provider_used?: string | null;
  model_used?: string | null;
}

export interface KnowledgeAttribute {
  label: string;
  value: string;
}

export interface TechResource {
  title: string;
  url: string;
  badge: string;
}

export interface KnowledgePanelData {
  title: string;
  subtitle?: string;
  entity_type?: string;
  description: string;
  image_url?: string;
  source_url?: string;
  source_name?: string;
  attributes?: KnowledgeAttribute[];
  tech_resources?: TechResource[];
  geo?: { latitude: number; longitude: number; bbox: number[] };
  related_topics?: string[];
  is_live?: boolean;
  provider?: string;
  attribution?: string;
}

export interface WeatherPanelData {
  location_name: string;
  latitude: number;
  longitude: number;
  temperature_c: number;
  wind_speed_kmh: number;
  wind_direction?: number;
  condition: string;
  condition_icon?: string;
  is_day?: boolean;
  timestamp?: string;
  is_live?: boolean;
  fallback_reason?: string;
  provider?: string;
  attribution?: string;
}

export interface MapPanelData {
  location_name: string;
  latitude: number;
  longitude: number;
  embed_url: string;
  osm_url: string;
  directions_url: string;
  provider?: string;
  attribution?: string;
  is_live?: boolean;
}

export interface NewsArticle {
  title: string;
  source: string;
  published_at: string;
  url: string;
  snippet: string;
}

export interface ImageItem {
  title: string;
  url: string;
  thumbnail_url: string;
  source_domain: string;
  source_url: string;
}

export interface SpecializedPanelsData {
  knowledge_panel?: KnowledgePanelData | null;
  weather?: WeatherPanelData | null;
  map?: MapPanelData | null;
  images?: ImageItem[];
  news?: NewsArticle[];
}

export type SSEEvent =
  | {
      event: 'search_started';
      data: {
        conversation_id?: string;
        query: string;
        mode: SearchMode;
        timestamp: number;
        provider?: string;
        model?: string;
        routing_reason?: string;
      };
    }
  | { event: 'query_intel'; data: any }
  | { event: 'status'; data: StatusEventData }
  | { event: 'sources'; data: SourcesEventData }
  | { event: 'specialized_panels'; data: SpecializedPanelsData }
  | { event: 'citations'; data: CitationItem[] }
  | { event: 'answer_chunk'; data: { delta: string } }
  | { event: 'completed'; data: CompletedEventData }
  | { event: 'error'; data: { message: string } };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// --- Codebase Intelligence Types ---

export interface DependencyNode {
  id: string;
  label: string;
  path: string;
  extension: string;
  lines: number;
  dependencies_out: number;
  dependencies_in: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
}

export interface DependencyGraphData {
  total_nodes: number;
  total_edges: number;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface ImpactDetail {
  file: string;
  distance: number;
  is_direct: boolean;
}

export interface ImpactAnalysisData {
  target_file: string;
  total_affected: number;
  impact_risk: 'low' | 'medium' | 'critical';
  direct_dependents: string[];
  transitive_dependents: string[];
  affected_details: ImpactDetail[];
  error?: string;
}

export interface TestGapItem {
  file: string;
  lines: number;
  symbols_count: number;
  criticality: 'high' | 'medium';
}

export interface TestGapsData {
  total_source_modules: number;
  tested_modules: number;
  untested_modules: number;
  coverage_percentage: number;
  test_files_detected: string[];
  gaps: TestGapItem[];
}

export interface SecurityFinding {
  file: string;
  line: number;
  rule: string;
  severity: 'high' | 'medium' | 'low';
  snippet: string;
  recommendation: string;
}

export interface SecurityInsightsData {
  total_findings: number;
  findings: SecurityFinding[];
}

export interface SearchSuggestion {
  name: string;
  kind: string;
  path: string;
  line?: number;
}

// --- Commercial Platform Entities ---

export interface Project {
  id: string;
  name: string;
  description?: string;
  workspace_root: string;
  custom_instructions?: string;
  created_at: number;
  updated_at: number;
}

export interface MessageItem {
  id: string;
  message_id?: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SearchResultItem[] | WebSearchResultItem[];
  citations?: CitationItem[];
  attachments?: any[];
  model?: string;
  created_at: number;
  timestamp?: number;
}

export interface Conversation {
  id: string;
  conversation_id?: string;
  project_id: string;
  title: string;
  search_mode: SearchMode;
  selected_mode?: SearchMode;
  ai_model?: string | null;
  selected_model?: string | null;
  parent_conversation_id?: string | null;
  branch_point_message_id?: string | null;
  message_count?: number;
  is_pinned?: boolean | number;
  created_at: number;
  updated_at: number;
  messages?: MessageItem[];
}

export interface Artifact {
  id: string;
  project_id: string;
  conversation_id?: string | null;
  title: string;
  artifact_type: string;
  language: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface PromptItem {
  id: string;
  title: string;
  category: string;
  description: string;
  prompt_text: string;
  is_builtin: number;
  created_at: number;
}

export interface BookmarkItem {
  id: string;
  project_id: string;
  title: string;
  item_type: string;
  data: Record<string, any>;
  created_at: number;
}

export interface DebugResult {
  error_message: string;
  matched_files: SearchResultItem[];
  analysis: string;
  ai_configured: boolean;
}

export interface ModelCompareResult {
  query: string;
  model_a: {
    name: string;
    response: string;
    latency_ms: number;
  };
  model_b: {
    name: string;
    response: string;
    latency_ms: number;
  };
}

export interface AIProviderStatus {
  id: string;
  name: string;
  model: string;
  is_default: boolean;
  is_fallback: boolean;
  configured: boolean;
  masked_key: string;
}

export interface DocumentRecord {
  id: string;
  project_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  created_at: number;
}

// --- ANVESHA V2: Multi-Agent Governance Types ---

export interface AgentRecord {
  id: string;
  name: string;
  description: string;
  role: string;
  system_prompt?: string;
  model_provider: string;
  model_name?: string | null;
  capabilities: string[];
  permissions: string[];
  status: 'idle' | 'assigned' | 'executing' | 'waiting_approval' | 'error';
  created_at: number;
  updated_at: number;
}

export interface TaskStepRecord {
  id: string;
  task_id: string;
  step_index: number;
  title: string;
  assigned_agent_id: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed';
  input_payload: Record<string, any>;
  output_payload?: Record<string, any> | null;
  governance_status: 'pending' | 'allowed' | 'approved' | 'denied';
  started_at?: number | null;
  completed_at?: number | null;
}

export interface MultiAgentTaskRecord {
  id: string;
  project_id: string;
  conversation_id?: string | null;
  goal: string;
  status: 'planning' | 'in_progress' | 'paused_approval' | 'completed' | 'failed';
  plan_dag: {
    workflow_type: string;
    goal: string;
    steps: Array<{
      step_index: number;
      title: string;
      assigned_agent_id: string;
      dependencies: number[];
      input_payload: Record<string, any>;
    }>;
  };
  steps?: TaskStepRecord[];
  final_output?: string | null;
  created_at: number;
  updated_at: number;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description?: string;
  target_action: string;
  condition: Record<string, any>;
  action_type: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface ApprovalRequest {
  id: string;
  task_id: string;
  step_id: string;
  agent_id: string;
  action_requested: string;
  parameters: Record<string, any>;
  risk_score: number;
  risk_explanation: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  review_reason?: string | null;
  created_at: number;
  resolved_at?: number | null;
}

export interface OrganizationalMemoryItem {
  id: string;
  project_id: string;
  memory_type: 'episodic' | 'semantic' | 'procedural' | 'decision';
  title: string;
  content: string;
  metadata: Record<string, any>;
  created_by: string;
  created_at: number;
}

export interface AgentMessageLog {
  id: string;
  task_id: string;
  step_id?: string | null;
  sender_id: string;
  recipient_id: string;
  message_type: string;
  content: Record<string, any>;
  governance_decision: string;
  timestamp: number;
}

// --- Adaptive AI Operating System Types ---

export type AdaptiveLayoutMode = 'auto' | 'search' | 'deep_research' | 'explorer' | 'multi_agent' | 'governance';

export interface AdaptiveClassificationResult {
  task_type: 'search' | 'research' | 'code' | 'multi_agent' | 'governance';
  complexity: 'simple' | 'moderate' | 'complex' | 'autonomous';
  complexity_score: number;
  confidence: number;
  recommended_layout: 'search' | 'deep_research' | 'explorer' | 'multi_agent' | 'governance';
  effective_layout: string;
  execution_strategy: 'direct_stream' | 'deep_research_loop' | 'dag_orchestration';
  provider: string;
  model: string;
  required_agents: string[];
  required_tools: string[];
  memory_requirements: {
    episodic: boolean;
    procedural: boolean;
    semantic: boolean;
  };
  requires_human_approval: boolean;
  risk_score: number;
  rationale: string;
  timestamp: number;
}

export interface ModelRouterStatus {
  status: string;
  capability_matrix: Record<string, {
    coding: number;
    reasoning: number;
    context_window: number;
    speed: number;
    cost_efficiency: number;
    description: string;
  }>;
  configured_providers: AIProviderStatus[];
  telemetry_metrics: Array<{
    provider_id: string;
    model_name: string;
    total_calls: number;
    avg_latency_ms: number;
    min_latency_ms: number;
    max_latency_ms: number;
    success_rate: number;
  }>;
  primary_provider: string;
}

export interface OptimizationRecommendation {
  id: string;
  category: 'performance' | 'prompt' | 'workflow' | 'model';
  title: string;
  description: string;
  impact_level: 'high' | 'medium' | 'low';
  metric_evidence: Record<string, any>;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  created_at: number;
  resolved_at?: number | null;
}

export interface OptimizationReport {
  status: string;
  telemetry_timestamp: number;
  execution_metrics: {
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    overall_success_rate: string;
  };
  bottlenecks: Array<{
    step_title: string;
    assigned_agent: string;
    avg_duration_sec: number;
    execution_count: number;
    failure_count: number;
  }>;
  model_telemetry: Array<{
    provider_id: string;
    model_name: string;
    total_calls: number;
    avg_latency_ms: number;
    success_rate: number;
  }>;
  repeated_errors: Array<{
    agent: string;
    details: string;
    count: number;
  }>;
  active_recommendations: OptimizationRecommendation[];
  governance_safeguard: string;
}

export interface AdaptiveIntentLog {
  id: string;
  query_text: string;
  classified_type: string;
  complexity: string;
  confidence: number;
  selected_layout: string;
  selected_model: string;
  user_override_layout?: string | null;
  created_at: number;
}

// ==========================================
// ANVESHA SEARCH 2.0 INTEGRATION TYPES
// ==========================================

export type PersonaMode = 'auto' | 'force_angel' | 'force_devil';

export interface PersonaProfile {
  name: string;
  title: string;
  tag: string;
  accent_color: string;
  tone: string;
  prompt: string;
}

export interface PersonaSettings {
  active_mode: PersonaMode;
  force_persona?: string | null;
  current_resolved: 'angel' | 'devil';
  angel_prompt_override?: string;
  devil_prompt_override?: string;
  profiles: {
    angel: PersonaProfile;
    devil: PersonaProfile;
  };
}

export type BrowserTabMode = 'normal' | 'incognito' | 'tor';

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  tab_mode: BrowserTabMode;
  is_active: boolean;
  favicon?: string;
  created_at: number;
  updated_at: number;
}

export interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
  folder: string;
  favicon?: string;
  created_at: number;
}

export interface BrowserHistoryItem {
  id: string;
  title: string;
  url: string;
  visit_time: number;
  tab_mode: BrowserTabMode;
}

export interface BrowserNavigateResult {
  action: 'navigate' | 'search';
  resolved_url: string;
  target_type: 'url' | 'search';
  query?: string;
  sanitized: boolean;
  tracking_params_stripped: string[];
  tor_routed: boolean;
  error?: string;
}

export interface ReaderArticle {
  title: string;
  content_markdown: string;
  content_clean_html: string;
  excerpt: string;
  author: string;
  site_name: string;
  word_count: number;
  reading_time_minutes: number;
  extracted_images: string[];
  original_url: string;
}

export interface TorStatus {
  is_available: boolean;
  proxy_host: string;
  proxy_port: number;
  is_listening: boolean;
  fail_closed_enforced: boolean;
  ip_clearnet?: string;
  ip_tor?: string | null;
  message: string;
}

export interface SecurityAuditResult {
  timestamp: number;
  security_score: number;
  https_enforced: boolean;
  tor_status: TorStatus;
  dns_leak_shield: boolean;
  webrtc_shield: boolean;
  tracker_blocking: {
    enabled: boolean;
    known_trackers_count: number;
    blocked_count_session: number;
  };
  installed_extensions_count: number;
  recommendations: string[];
  tracker_domains_blocked_total: number;
  safe_browsing_status: string;
}

export type ResearchDepth = 'quick' | 'deep' | 'extended';

export interface ResearchContradiction {
  source_a: string;
  claim_a: string;
  source_b: string;
  claim_b: string;
  explanation: string;
}

export interface ResearchReport {
  id: string;
  query: string;
  depth: ResearchDepth;
  title: string;
  summary: string;
  full_report_markdown: string;
  sources: Array<{ title: string; url: string; snippet?: string }>;
  contradictions: ResearchContradiction[];
  created_at: number;
  updated_at: number;
}

export interface CuratedExtension {
  id: string;
  name: string;
  version: string;
  sdkVersion: string;
  description: string;
  category: string;
  author: string;
  permissions: string[];
  scriptCode: string;
  defaultInstalled?: boolean;
  defaultEnabled?: boolean;
  installed?: boolean;
  enabled?: boolean;
}

// --- Worldwide Global News Types ---

export interface GlobalNewsArticle {
  id: string;
  title: string;
  original_url: string;
  source_name: string;
  source_domain: string;
  category: string;
  country: string;
  language: string;
  published_at: string;
  summary: string;
  image_url?: string | null;
  provider: 'worldpulse' | 'actually_relevant' | 'rss' | 'freshrss';
  outlets_count: number;
  reliability_score: number;
  cluster_id?: string | null;
  is_breaking?: boolean;
  raw_metadata?: Record<string, any>;
}

export interface GlobalStoryCluster {
  cluster_id: string;
  title: string;
  primary_article: GlobalNewsArticle;
  related_articles: GlobalNewsArticle[];
  outlets_count: number;
  participating_sources: string[];
  key_facts: string[];
  conflicting_claims: string[];
  category: string;
  country: string;
  language: string;
  updated_at: string;
}

export interface GlobalNewsResponse {
  total: number;
  offset: number;
  limit: number;
  last_updated: string;
  articles: GlobalNewsArticle[];
  clusters: GlobalStoryCluster[];
  breaking: GlobalNewsArticle[];
  providers_status: string;
}

export interface GlobalNewsTrendingItem {
  topic: string;
  cluster_id: string;
  category: string;
  outlets_count: number;
  primary_title: string;
  url: string;
  source_name: string;
}

export interface GlobalNewsBriefing {
  title: string;
  date: string;
  summary: string;
  key_events: Array<{
    headline: string;
    outlets_count: number;
    sources: string[];
    key_facts: string[];
  }>;
  sources: Array<{
    title: string;
    source_name: string;
    url: string;
  }>;
  disclaimer: string;
}

export interface AskAIStoryResult {
  story_id: string;
  story_title: string;
  answer: string;
  verified_facts: string[];
  conflicting_or_unconfirmed: string[];
  sources: Array<{
    title: string;
    source_name: string;
    url: string;
  }>;
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export interface LanguageOption {
  code: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}
