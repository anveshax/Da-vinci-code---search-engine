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
  id: string;
  name: string;
  version: string;
  sdkVersion: string;
  description: string;
  author?: string;
  permissions: ExtensionPermission[];
  entryPoint?: {
    frontend?: string;
    backend?: string;
  };
  sidePanel?: {
    title: string;
    icon?: string;
    defaultWidth?: number;
  };
  contributions?: {
    commands?: Array<{ id: string; title: string; category?: string }>;
    settings?: Record<string, any>;
  };
}

export interface ExtensionRecord {
  id: string;
  name: string;
  version: string;
  manifest: ExtensionManifest;
  installed: boolean;
  enabled: boolean;
  visible: boolean;
  health_status: 'healthy' | 'degraded' | 'error' | 'disabled';
  health_message?: string;
  created_at: number;
  updated_at: number;
}

export interface ExtensionAuditLog {
  id: string;
  extension_id: string;
  action: string;
  details: Record<string, any>;
  timestamp: number;
}
