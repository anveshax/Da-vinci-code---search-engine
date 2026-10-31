/**
 * Anvesha Extension Registry & Runtime Loader Service.
 *
 * Handles:
 * - API synchronization with backend Extension Registry (/api/v2/extensions)
 * - Safe lifecycle execution (onActivate, onDeactivate)
 * - Strict state enforcement: disabled extensions never execute code
 * - Sandboxed ExtensionContext creation with permission boundary checks
 * - Inter-extension Event Bus
 */

import { getApiBaseUrl } from './api';
import { ExtensionRecord, ExtensionManifest, ExtensionPermission, ExtensionAuditLog } from '../types/extension';

export interface SandboxedContext {
  manifest: ExtensionManifest;
  storage: {
    get: <T = any>(key: string) => Promise<T | null>;
    set: <T = any>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
    list: () => Promise<Record<string, any>>;
  };
  events: {
    on: (event: string, handler: (payload: any) => void) => () => void;
    emit: (event: string, payload: any) => void;
  };
  http: {
    fetch: <T = any>(url: string, init?: { method?: string; headers?: Record<string, string>; body?: any }) => Promise<{ status: number; data: T }>;
  };
  workspace: {
    getActiveProject: () => Promise<{ id: string; name: string; workspaceRoot: string } | null>;
  };
  ui: {
    showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  };
}

class ExtensionRegistryService {
  private activeInstances = new Map<string, any>();
  private eventListeners = new Map<string, Set<(payload: any) => void>>();
  private notificationsListeners = new Set<(notif: { message: string; type: string }) => void>();

  private getBaseUrl(): string {
    return `${getApiBaseUrl()}/api/v2/extensions`;
  }

  // --- API Methods ---

  async fetchExtensions(): Promise<ExtensionRecord[]> {
    try {
      const res = await fetch(this.getBaseUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.extensions || [];
    } catch (err) {
      console.error('[ExtensionRegistry] Failed to fetch extensions:', err);
      return [];
    }
  }

  async registerExtension(manifest: ExtensionManifest): Promise<ExtensionRecord> {
    const res = await fetch(`${this.getBaseUrl()}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to register extension' }));
      throw new Error(err.detail || 'Failed to register extension');
    }
    const data = await res.json();
    return data.extension;
  }

  async installExtension(id: string): Promise<ExtensionRecord> {
    const res = await fetch(`${this.getBaseUrl()}/${id}/install`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to install' }));
      throw new Error(err.detail || 'Failed to install');
    }
    const data = await res.json();
    return data.extension;
  }

  async uninstallExtension(id: string): Promise<ExtensionRecord> {
    // If active in memory, deactivate first
    await this.deactivateExtension(id);
    const res = await fetch(`${this.getBaseUrl()}/${id}/uninstall`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to uninstall' }));
      throw new Error(err.detail || 'Failed to uninstall');
    }
    const data = await res.json();
    return data.extension;
  }

  async enableExtension(id: string): Promise<ExtensionRecord> {
    const res = await fetch(`${this.getBaseUrl()}/${id}/enable`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to enable' }));
      throw new Error(err.detail || 'Failed to enable');
    }
    const data = await res.json();
    return data.extension;
  }

  async disableExtension(id: string): Promise<ExtensionRecord> {
    // Immediately deactivate instance from memory
    await this.deactivateExtension(id);
    const res = await fetch(`${this.getBaseUrl()}/${id}/disable`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to disable' }));
      throw new Error(err.detail || 'Failed to disable');
    }
    const data = await res.json();
    return data.extension;
  }

  async setVisibility(id: string, visible: boolean): Promise<ExtensionRecord> {
    const res = await fetch(`${this.getBaseUrl()}/${id}/visibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to update visibility' }));
      throw new Error(err.detail || 'Failed to update visibility');
    }
    const data = await res.json();
    return data.extension;
  }

  async fetchAuditLogs(id: string): Promise<ExtensionAuditLog[]> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/${id}/audit`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.logs || [];
    } catch {
      return [];
    }
  }

  // --- Sandboxed Storage ---

  async getStorage<T = any>(extensionId: string, key: string): Promise<T | null> {
    const res = await fetch(`${this.getBaseUrl()}/${extensionId}/storage?key=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.value ?? null;
  }

  async listStorage(extensionId: string): Promise<Record<string, any>> {
    const res = await fetch(`${this.getBaseUrl()}/${extensionId}/storage`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.storage || {};
  }

  async setStorage<T = any>(extensionId: string, key: string, value: T): Promise<void> {
    const res = await fetch(`${this.getBaseUrl()}/${extensionId}/storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Storage write failed' }));
      throw new Error(err.detail || 'Storage write failed');
    }
  }

  async deleteStorage(extensionId: string, key: string): Promise<boolean> {
    const res = await fetch(`${this.getBaseUrl()}/${extensionId}/storage/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    return res.ok;
  }

  // --- SSRF-Safe Proxy Network ---

  async proxyFetch<T = any>(
    extensionId: string,
    url: string,
    options?: { method?: string; headers?: Record<string, string>; body?: any }
  ): Promise<{ status: number; data: T }> {
    const res = await fetch(`${this.getBaseUrl()}/${extensionId}/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Outbound fetch failed' }));
      throw new Error(err.detail || 'Outbound fetch failed');
    }
    const data = await res.json();
    return { status: data.status_code, data: data.data };
  }

  // --- Event Bus ---

  onEvent(event: string, handler: (payload: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  emitEvent(event: string, payload: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(payload);
        } catch (e) {
          console.error(`[Extension Event Error] ${event}:`, e);
        }
      });
    }
  }

  onNotification(listener: (notif: { message: string; type: string }) => void): () => void {
    this.notificationsListeners.add(listener);
    return () => this.notificationsListeners.delete(listener);
  }

  notifyUI(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    this.notificationsListeners.forEach((l) => l({ message, type }));
  }

  // --- Sandboxed Context Factory ---

  createContext(record: ExtensionRecord): SandboxedContext {
    const manifest = record.manifest;
    const permissions: ExtensionPermission[] = manifest.permissions || [];

    const hasPermission = (perm: ExtensionPermission) => permissions.includes(perm);

    return {
      manifest,
      storage: {
        get: async <T = any>(key: string): Promise<T | null> => {
          if (!hasPermission('storage:read')) {
            throw new Error(`Permission 'storage:read' denied for extension ${record.id}`);
          }
          return this.getStorage<T>(record.id, key);
        },
        set: async <T = any>(key: string, value: T): Promise<void> => {
          if (!hasPermission('storage:write')) {
            throw new Error(`Permission 'storage:write' denied for extension ${record.id}`);
          }
          return this.setStorage<T>(record.id, key, value);
        },
        delete: async (key: string): Promise<boolean> => {
          if (!hasPermission('storage:write')) {
            throw new Error(`Permission 'storage:write' denied for extension ${record.id}`);
          }
          return this.deleteStorage(record.id, key);
        },
        list: async (): Promise<Record<string, any>> => {
          if (!hasPermission('storage:read')) {
            throw new Error(`Permission 'storage:read' denied for extension ${record.id}`);
          }
          return this.listStorage(record.id);
        },
      },
      events: {
        on: (event: string, handler: (payload: any) => void) => {
          if (!hasPermission('events:listen')) {
            console.warn(`Permission 'events:listen' not declared by ${record.id}`);
            return () => {};
          }
          return this.onEvent(event, handler);
        },
        emit: (event: string, payload: any) => {
          if (!hasPermission('events:emit')) {
            throw new Error(`Permission 'events:emit' denied for extension ${record.id}`);
          }
          this.emitEvent(event, payload);
        },
      },
      http: {
        fetch: async <T = any>(url: string, init?: { method?: string; headers?: Record<string, string>; body?: any }) => {
          if (!hasPermission('network:fetch')) {
            throw new Error(`Permission 'network:fetch' denied for extension ${record.id}`);
          }
          return this.proxyFetch<T>(record.id, url, init);
        },
      },
      workspace: {
        getActiveProject: async () => {
          if (!hasPermission('workspace:read')) {
            throw new Error(`Permission 'workspace:read' denied for extension ${record.id}`);
          }
          return { id: 'default', name: 'Main Repository', workspaceRoot: '/workspace' };
        },
      },
      ui: {
        showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
          this.notifyUI(`[${manifest.name}] ${message}`, type);
        },
      },
    };
  }

  // --- Runtime Lifecycle ---

  async activateExtension(record: ExtensionRecord, instanceModule?: any): Promise<void> {
    if (!record.installed || !record.enabled) {
      throw new Error(`Cannot activate extension '${record.id}': must be installed and enabled.`);
    }

    const context = this.createContext(record);
    this.activeInstances.set(record.id, { context, module: instanceModule });

    if (instanceModule && typeof instanceModule.onActivate === 'function') {
      try {
        await instanceModule.onActivate(context);
      } catch (err) {
        console.error(`[Extension Activate Error] ${record.id}:`, err);
      }
    }
  }

  async deactivateExtension(id: string): Promise<void> {
    const active = this.activeInstances.get(id);
    if (!active) return;

    if (active.module && typeof active.module.onDeactivate === 'function') {
      try {
        await active.module.onDeactivate();
      } catch (err) {
        console.error(`[Extension Deactivate Error] ${id}:`, err);
      }
    }
    this.activeInstances.delete(id);
  }

  isActivated(id: string): boolean {
    return this.activeInstances.has(id);
  }
}

export const extensionRegistry = new ExtensionRegistryService();
