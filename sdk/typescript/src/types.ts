/**
 * Core Type Definitions for Anvesha Extension SDK v1.0.0.
 */

export type ExtensionPermission =
  | 'storage:read'
  | 'storage:write'
  | 'workspace:read'
  | 'network:fetch'
  | 'ui:sidepanel'
  | 'events:listen'
  | 'events:emit'
  | 'audit:log';

export interface ExtensionManifest {
  /** Unique reverse-domain or kebab identifier, e.g. 'anvesha.git-metrics' */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Semver string, e.g. '1.0.0' */
  version: string;
  /** Target Anvesha SDK version, e.g. '1.0.0' */
  sdkVersion: string;
  /** Brief description of capabilities */
  description: string;
  /** Extension author or team */
  author?: string;
  /** Explicitly declared platform permissions */
  permissions: ExtensionPermission[];
  /** Entrypoint configuration */
  entryPoint: {
    frontend?: string;
    backend?: string;
  };
  /** Side panel display metadata */
  sidePanel?: {
    title: string;
    icon?: string;
    defaultWidth?: number;
  };
  /** Extended platform contributions */
  contributions?: {
    commands?: Array<{
      id: string;
      title: string;
      category?: string;
    }>;
    settings?: Record<string, any>;
  };
}

export interface ExtensionStorage {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<Record<string, any>>;
}

export interface ExtensionEvents {
  on(event: string, handler: (payload: any) => void): () => void;
  emit(event: string, payload: any): void;
}

export interface ExtensionHttp {
  fetch<T = any>(url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<{ status: number; data: T }>;
}

export interface ExtensionWorkspace {
  getActiveProject(): Promise<{ id: string; name: string; workspaceRoot: string } | null>;
}

export interface ExtensionUI {
  showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
}

export interface ExtensionContext {
  manifest: ExtensionManifest;
  storage: ExtensionStorage;
  events: ExtensionEvents;
  http: ExtensionHttp;
  workspace: ExtensionWorkspace;
  ui: ExtensionUI;
}

export interface AnveshaExtension {
  onActivate?(context: ExtensionContext): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;
  renderSidePanel?(container: HTMLElement, context: ExtensionContext): void | (() => void);
}
